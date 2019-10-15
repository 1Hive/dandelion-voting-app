import Aragon, { events } from "@aragon/api";
import { addressesEqual } from "./web3-utils";
import voteSettings from "./vote-settings";
import { VOTE_ABSENT } from "./vote-types";
import { voteTypeFromContractEnum } from "./vote-utils";
import { EMPTY_CALLSCRIPT } from "./evmscript-utils";
import tokenDecimalsAbi from "./abi/token-decimals.json";
import tokenSymbolAbi from "./abi/token-symbol.json";
import { toUnicode } from "punycode";

const tokenAbi = [].concat(tokenDecimalsAbi, tokenSymbolAbi);

const app = new Aragon();

let connectedAccount;

/*
 * Calls `callback` exponentially, everytime `retry()` is called.
 * Returns a promise that resolves with the callback's result if it (eventually) succeeds.
 *
 * Usage:
 *
 * retryEvery(retry => {
 *  // do something
 *
 *  if (condition) {
 *    // retry in 1, 2, 4, 8 seconds… as long as the condition passes.
 *    retry()
 *  }
 * }, 1000, 2)
 *
 */
const retryEvery = async (
  callback,
  { initialRetryTimer = 1000, increaseFactor = 3, maxRetries = 3 } = {}
) => {
  const sleep = time => new Promise(resolve => setTimeout(resolve, time));

  let retryNum = 0;
  const attempt = async (retryTimer = initialRetryTimer) => {
    try {
      return await callback();
    } catch (err) {
      if (retryNum === maxRetries) {
        throw err;
      }
      ++retryNum;

      // Exponentially backoff attempts
      const nextRetryTime = retryTimer * increaseFactor;
      console.log(
        `Retrying in ${nextRetryTime}s... (attempt ${retryNum} of ${maxRetries})`
      );
      await sleep(nextRetryTime);
      return attempt(nextRetryTime);
    }
  };

  return attempt();
};

// Get the token address to initialize ourselves
retryEvery(() =>
  app
    .call("token")
    .toPromise()
    .then(initialize)
    .catch(err => {
      console.error(
        "Could not start background script execution due to the contract not loading the token:",
        err
      );
      throw err;
    })
);

async function initialize(tokenAddr) {
  return app.store(
    (state, { blockNumber, event, returnValues, transactionHash }) => {
      const nextState = {
        ...state
      };

      switch (event) {
        case events.ACCOUNTS_TRIGGER:
          return updateConnectedAccount(nextState, returnValues);
        case events.SYNC_STATUS_SYNCING:
          return { ...nextState, isSyncing: true };
        case events.SYNC_STATUS_SYNCED:
          return { ...nextState, isSyncing: false };
        case "CastVote":
          console.log("CAST VOTEEEEE");
          return castVote(nextState, returnValues);
        case "ExecuteVote":
          console.log("EXECUTE VOTE");
          return executeVote(nextState, returnValues, {
            blockNumber,
            transactionHash
          });
        case "StartVote":
          console.log("START VOTEEEEE");
          return startVote(nextState, returnValues);
        default:
          return nextState;
      }
    },
    { init: initState(tokenAddr) }
  );
}

const initState = tokenAddr => async cachedState => {
  const token = app.external(tokenAddr, tokenAbi);

  let tokenSymbol;
  try {
    tokenSymbol = await token.symbol().toPromise();
    const pctBase = parseInt(await app.call("PCT_BASE").toPromise(), 10);
    const supportRequiredPct = parseInt(
      await app.call("supportRequiredPct").toPromise(),
      10
    );
    const supportRequired = Math.round((supportRequiredPct / pctBase) * 100);
    app.identify(`${tokenSymbol} (${supportRequired}%)`);
  } catch (err) {
    console.error(
      `Failed to load information to identify voting app due to:`,
      err
    );
  }

  let tokenDecimals;
  try {
    tokenDecimals = (await token.decimals().toPromise()) || "0";
  } catch (err) {
    console.error(
      `Failed to load token decimals for token at ${tokenAddr} due to:`,
      err
    );
    console.error("Defaulting to 0...");
    tokenDecimals = "0";
  }

  const voteSettings = await loadVoteSettings();

  return {
    ...cachedState,
    isSyncing: true,
    tokenDecimals,
    tokenSymbol,
    ...voteSettings
  };
};

/***********************
 *                     *
 *   Event Handlers    *
 *                     *
 ***********************/

async function updateConnectedAccount(state, { account }) {
  connectedAccount = account;
  return {
    ...state,
    // fetch all the votes casted by the connected account
    connectedAccountVotes: state.votes
      ? await getAccountVotes({
          connectedAccount: account,
          votes: state.votes
        })
      : {}
  };
}

async function castVote(state, { voteId, voter }) {
  console.log("*** CastVote ", voter);
  const { connectedAccountVotes } = state;
  // If the connected account was the one who made the vote, update their voter status
  if (addressesEqual(connectedAccount, voter)) {
    // fetch vote state for the connected account for this voteId
    const { voteType } = await loadVoterState({
      connectedAccount,
      voteId
    });
    connectedAccountVotes[voteId] = voteType;
  }

  const transform = async vote => ({
    ...vote,
    data: {
      ...vote.data,
      ...(await loadVoteData(voteId))
    }
  });

  return updateState({ ...state, connectedAccountVotes }, voteId, transform);
}

async function executeVote(
  state,
  { voteId },
  { blockNumber, transactionHash }
) {
  const transform = async ({ data, ...vote }) => ({
    ...vote,
    data: {
      ...data,
      executed: true,
      executionDate: await loadBlockTimestamp(blockNumber),
      executionTransaction: transactionHash
    }
  });
  return updateState(state, voteId, transform);
}

async function startVote(state, { creator, metadata = "", voteId }) {
  return updateState(state, voteId, vote => ({
    ...vote,
    data: {
      ...vote.data,
      creator,
      metadata
    }
  }));
}

/***********************
 *                     *
 *       Helpers       *
 *                     *
 ***********************/

async function updateState(state, voteId, transform) {
  const { votes = [] } = state;

  return {
    ...state,
    votes: await updateVotes(votes, voteId, transform)
  };
}

async function updateVotes(votes, voteId, transform) {
  console.log("*** UpdateVotes votes ", votes);
  console.log("*** UpdateVotes voteId ", voteId);
  const voteIndex = votes.findIndex(vote => vote.voteId === voteId);
  console.log("*** UpdateVotes index ", voteIndex);

  if (voteIndex === -1) {
    // If we can't find it, load its data, perform the transformation, and concat
    const ret = votes.concat(
      await transform({
        voteId,
        data: await loadVoteData(voteId)
      })
    );
    console.log("*** UpdateVotes votes transformed ", ret);
    return ret;
  } else {
    const nextVotes = Array.from(votes);
    nextVotes[voteIndex] = await transform(nextVotes[voteIndex]);
    return nextVotes;
  }
}

// Default votes to an empty array to prevent errors on initial load
async function getAccountVotes({ connectedAccount, votes = [] }) {
  const connectedAccountVotes = await Promise.all(
    votes.map(({ voteId }) => loadVoterState({ connectedAccount, voteId }))
  )
    .then(voteStates =>
      voteStates.reduce((states, { voteId, voteType }) => {
        states[voteId] = voteType;
        return states;
      }, {})
    )
    .catch(console.error);

  return connectedAccountVotes;
}

async function loadVoterState({ connectedAccount, voteId }) {
  if (!connectedAccount) {
    return {
      voteId,
      voteType: VOTE_ABSENT
    };
  }
  // Wrap with retry in case the vote is somehow not present
  return retryEvery(() =>
    app
      .call("getVoterState", voteId, connectedAccount)
      .toPromise()
      .then(voteTypeFromContractEnum)
      .then(voteType => ({ voteId, voteType }))
      .catch(err => {
        console.error(
          `Error fetching voter state (${connectedAccount}, ${voteId})`,
          err
        );
        throw err;
      })
  );
}

async function loadVoteDescription(vote) {
  vote.description = "";
  vote.executionTargets = [];

  if (!vote.script || vote.script === EMPTY_CALLSCRIPT) {
    return vote;
  }

  try {
    const path = await app.describeScript(vote.script).toPromise();

    // Get unique list of targets
    vote.executionTargets = [...new Set(path.map(({ to }) => to))];
    vote.description = path
      ? path
          .map(step => {
            const identifier = step.identifier ? ` (${step.identifier})` : "";
            const app = step.name ? `${step.name}${identifier}` : `${step.to}`;

            return `${app}: ${step.description || "No description"}`;
          })
          .join("\n")
      : "";
  } catch (error) {
    console.error("Error describing vote script", error);
    vote.description = "Invalid script. The result cannot be executed.";
  }

  return vote;
}

function loadVoteData(voteId) {
  // Wrap with retry in case the vote is somehow not present
  return retryEvery(() =>
    app
      .call("getVote", voteId)
      .toPromise()
      .then(vote => loadVoteDescription(marshallVote(vote)))
      .catch(err => {
        console.error(`Error fetching vote (${voteId})`, err);
        throw err;
      })
  );
}

function loadVoteSettings() {
  return Promise.all(
    voteSettings.map(([name, key, type = "string"]) =>
      app
        .call(name)
        .toPromise()
        .then(val => (type === "time" ? marshallDate(val) : val))
        .then(value => ({ [key]: value }))
    )
  )
    .then(settings =>
      settings.reduce((acc, setting) => ({ ...acc, ...setting }), {})
    )
    .catch(err => {
      console.error("Failed to load Vote settings", err);
      // Return an empty object to try again later
      return {};
    });
}

async function loadBlockTimestamp(blockNumber) {
  const { timestamp } = await app.web3Eth("getBlock", blockNumber).toPromise();
  // Adjust for solidity time (s => ms)
  return timestamp * 1000;
}

// Apply transformations to a vote received from web3
// Note: ignores the 'open' field as we calculate that locally
async function marshallVote({
  executed,
  minAcceptQuorum,
  nay,
  snapshotBlock,
  startBlock,
  supportRequired,
  votingPower,
  yea,
  script
}) {
  //console.log("Marshal vote **** start block  ", startBlock);
  //const startDate = await loadBlockTimestamp(startBlock);
  //console.log("Marsahl vote **** startDate ", startDate);

  return {
    executed,
    minAcceptQuorum,
    nay,
    script,
    supportRequired,
    votingPower,
    yea,
    // Like times, blocks should be safe to represent as real numbers
    snapshotBlock: parseInt(snapshotBlock, 10),
    startBlock: parseInt(startBlock, 10)
  };
}

function marshallDate(date) {
  // Represent dates as real numbers, as it's very unlikely they'll hit the limit...
  // Adjust for js time (in ms vs s)
  return parseInt(date, 10) * 1000;
}