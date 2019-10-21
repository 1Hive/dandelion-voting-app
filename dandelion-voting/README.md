# Dandelion voting <img align="right" src="https://github.com/1Hive/website/blob/master/website/static/img/bee.png" height="80px" />

The Dandelion Voting app is a fork of the [Aragon Voting app](https://github.com/aragon/aragon-apps/tree/master/apps/voting) with some modifications:
- It records the last time a voter voted in favour of a vote.
- It removes the ability to recast votes.
- It removes the ability to execute (and therefore finalise) votes until they have ended.
- It adds a buffer time between votes preventing new votes from starting until the buffer time has passed.
- Vote lengths are defined in numbers of blocks instead of time.

> Note: it is expected that Dandelion Voting will be used with a non-transferable token.

#### 🐲 Project stage: development

The Dandelion Voting app is still under development. If you are interested in contributing please see our open [issues](https://github.com/1Hive/dissent-voting-app/issues).

#### 🚨 Security review status: pre-audit

The code in this repo has not been audited.

## How does it work?

TBD, but until then see above description.

## Initialization

The Dandelion Voting app is initialized with a `MiniMeToken _token`, `uint64 _supportRequiredPct`, `uint64 _minAcceptQuorumPct`, `uint64 _voteDurationBlocks`, and `uint64 _voteBufferBlocks`.
- `MiniMeToken _token` refers to the token that will be used to vote
- `uint64 _supportRequiredPct` refers to the support required to pass a vote
- `uint64 _minAcceptQuorumPct` refers to the quorum required to pass a vote
- `uint64 _voteDurationBlocks` refers to number of blocks that a vote stays open
- `uint64 _voteBufferBlocks` refers to the minimum number of blocks between the start block of each vote

## Roles

The Dandelion Voting app should implement the following roles:
- **CREATE_VOTES_ROLE**: This allows for changing the Aragon app that can create votes
- **MODIFY_SUPPORT_ROLE**: This allows for changing the amount of support required to pass a vote
- **MODIFY_QUORUM_ROLE**: This allows for changing the quorum required to pass votes
- **MODIFY_BUFFER_BLOCKS_ROLE**: This allows for changing the minimum number of blocks between the start block of each vote

## Interface

TBD

## Running locally

More details TBD, but here's how you can run tests.

Running tests requires slightly alternative calls to what is usually expected to ensure we use the projects package versions rather than any globally installed ones.

Install packages:
```
npm install
```

Run a test chain in a separate terminal:
```
npx aragon devchain
```

Run tests:
```
npx truffle test --network rpc
```

## Installing to an Aragon DAO

TBD

## Contributing

We welcome community contributions!

Please check out our [open Issues](https://github.com/1Hive/dissent-voting-app/issues) to get started.

If you discover something that could potentially impact security, please notify us immediately. The quickest way to reach us is via the #dev channel in our [team Keybase chat](https://1hive.org/contribute/keybase). Just say hi and that you discovered a potential security vulnerability and we'll DM you to discuss details.

