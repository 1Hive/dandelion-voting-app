import { useMemo, useState, useEffect } from "react";
import {
  useAppState,
  useCurrentApp,
  useInstalledApps,
  useApi
} from "@aragon/api-react";
import { isVoteOpen, isVotePending } from "../vote-utils";
import { VOTE_ABSENT } from "../vote-types";
import { EMPTY_ADDRESS } from "../web3-utils";
import useBlockNumber from "./useBlockNumber";

// Temporary fix to make sure executionTargets always returns an array, until
// we find out the reason why it can sometimes be missing in the cached data.
function getVoteExecutionTargets(vote) {
  return vote.data.executionTargets || [];
}

async function loadBlockTimestamp(blockNumber, api) {
  const { timestamp } = await api.web3Eth("getBlock", blockNumber).toPromise();
  // Adjust for solidity time (s => ms)
  return timestamp * 1000;
}

// Decorate the votes array with more information relevant to the frontend
function useDecoratedVotes() {
  const { votes, connectedAccountVotes } = useAppState();
  const currentApp = useCurrentApp();
  const installedApps = useInstalledApps();

  return useMemo(() => {
    if (!votes) {
      return [[], []];
    }
    const decoratedVotes = votes.map((vote, i) => {
      const executionTargets = getVoteExecutionTargets(vote);

      let targetApp;
      if (!executionTargets.length) {
        // If there's no execution target, consider it targetting this Voting app
        targetApp = {
          ...currentApp,
          // Don't attach an identifier for this Voting app
          identifier: undefined
        };
      } else if (executionTargets.length > 1) {
        // If there's multiple targets, make a "multiple" version
        targetApp = {
          appAddress: EMPTY_ADDRESS,
          name: "Multiple"
        };
      } else {
        // Otherwise, try to find the target from the installed apps
        const [targetAddress] = executionTargets;

        targetApp = installedApps.find(app => app.appAddress === targetAddress);
        if (!targetApp) {
          targetApp = {
            appAddress: targetAddress,
            icon: () => null,
            name: "External"
          };
        }
      }

      let executionTargetData = {};
      if (targetApp) {
        const { appAddress, icon, identifier, name } = targetApp;
        executionTargetData = {
          address: appAddress,
          name,
          iconSrc: icon(24),
          identifier
        };
      }

      return {
        ...vote,
        executionTargetData,
        connectedAccountVote: connectedAccountVotes[vote.voteId] || VOTE_ABSENT
      };
    });

    // Reduce the list of installed apps to just those that have been targetted by apps
    const executionTargets = installedApps
      .filter(app =>
        votes.some(vote =>
          getVoteExecutionTargets(vote).includes(app.appAddress)
        )
      )
      .map(({ appAddress, identifier, name }) => ({
        appAddress,
        identifier,
        name
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return [decoratedVotes, executionTargets];
  }, [votes, connectedAccountVotes, currentApp, installedApps]);
}

// Get the votes array ready to be used in the app.
export default function useVotes() {
  const [votes, executionTargets] = useDecoratedVotes();
  const [votesTimestamps, setVotesTimestamps] = useState(new Map());
  const blockNumber = useBlockNumber();
  const api = useApi();

  useEffect(() => {
    const getTimeStamps = async () => {
      await Promise.all(votes.map(vote => setTimeStamps(vote, api)));
    };
    getTimeStamps();
  }, [api, votes, blockNumber]);

  const setTimeStamps = async (vote, api) => {
    const timestamp = await loadBlockTimestamp(vote.data.startBlock, api);
    setVotesTimestamps(votesTimestamps.set(vote.voteId, timestamp));
  };

  const openedStates = votes.map(v => isVoteOpen(v, blockNumber));
  const pendingToStartStates = votes.map(v => isVotePending(v, blockNumber));
  const openedStatesKey = openedStates.join("");
  const pendingStatesKey = pendingToStartStates.join("");
  const votesTimeStampsKey = JSON.stringify([...votesTimestamps]);

  return [
    useMemo(() => {
      return votes.map((vote, i) => ({
        ...vote,
        data: {
          ...vote.data,
          open: openedStates[i],
          pending: pendingToStartStates[i],
          startDate: votesTimestamps.get(vote.voteId) || null
        }
      }));
    }, [votes, votesTimeStampsKey, openedStatesKey, pendingStatesKey]), // eslint-disable-line react-hooks/exhaustive-deps
    executionTargets
  ];
}
