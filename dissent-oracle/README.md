# Dissent Oracle <img align="right" src="https://github.com/1Hive/website/blob/master/website/static/img/bee.png" height="80px" />

The Dissent Oracle app is an [ACL Oracle](https://hack.aragon.org/docs/acl_IACLOracle). ACL Oracles are small helper functions that plug in to Aragon's access control list (ACL) to do more sophisticated permission evaluation. The Dissent Oracle is installed along with the Dandelion Voting app to prevent engagement when a user has recently voted in favour of a proposal.

#### 🐲 Project stage: development

The Time Lock app is still in development, a first implementation was published to `time-lock.open.aragonpm.eth`. If you are interested in contributing please see our open [issues](https://github.com/1hive/time-lock-app/issues).

#### 🚨 Security review status: pre-audit

The code in this repo has not been audited.

## How does it work?

The Dissent Oracle is initialized with a dissent window. The dissent window is the window of time in which an account cannot dissent (exit the Dandelion Org) if they have performed an action (such as voting `yes` for a proposal). The Dandelion Voting app queries the Dissent Oracle (through the ACL) to check if an account voted `yes` within the dissent window. In the context of Dandelion Orgs this is used to check if an account can or cannot redeem tokens from the Redemptions app.

> Note: this will not work with the regular Aragon voting application because it does not track the last block in which a voter voted yea.

## Initialization

The Dissent Oracle app is initialized with an `address _dandelionVoting` and `uint64 _dissentWindowBlocks`. The `address _dandelionVoting` is the address of the voting app that the Dissent Oracle is to query. The `uint64 _dissentWindowBlocks` is the time window within which the dissent oracle should return a boolean.

## Roles
The Dissent Oracle app should implement the following roles:
- **SET_DANDELION_VOTING_ROLE**: This role allows for changing the voting app address queried by the Dissent Oracle.
- **SET_DISSENT_WINDOW_ROLE**: This role allows for changing the length of the dissent window.

## Interface

The Dissent Oracle does not have an interface. It is meant as a back-end helper function for Aragon applications to perform more sophisticated permissions evaluation.

## How to run locally

The dissent Oracle must be installed in the context of a DAO that has a voting app. An example of this can be found in the [Danelion Voting app README](https://github.com/1Hive/dissent-voting-app/tree/master/dandelion-voting).

## Installing to an Aragon DAO

TBD

## Contributing

We welcome community contributions!

Please check out our [open Issues](https://github.com/1Hive/time-lock-app/issues) to get started.

If you discover something that could potentially impact security, please notify us immediately. The quickest way to reach us is via the #dev channel in our [team Keybase chat](https://1hive.org/contribute/keybase). Just say hi and that you discovered a potential security vulnerability and we'll DM you to discuss details.

