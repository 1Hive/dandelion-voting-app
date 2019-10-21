# Dissent-Voting <img align="right" src="https://github.com/1Hive/website/blob/master/website/static/img/bee.png" height="80px" />

The dissent-voting app enables organizations to restrict voting to those who have not expressed approval in recent votes. This is achieved through a combination of the [Dandelion Voting](https://github.com/1Hive/dissent-voting-app/tree/master/dandelion-voting) and [Dissent Oracle](https://github.com/1Hive/dissent-voting-app/tree/master/dissent-oracle). Dandelion Voting keeps track of who has voted `yay` or `nay` on each proposal and when that vote took place. The Dissent Oracle then checks whether an account has voted `yay` on a proposal within the time-frame of the dissent-window and returns a boolean expressing that fact. This allows other applications (such as [Redemptions](https://github.com/1Hive/redemptions-app/)) to restrict actions based on the response from the Dissent Oracle.

> Note: The Dissent Oracle and Dandelion Voting applications are meant to be deployed together as the Dissent Oracle will not work on other Aragon voting applications.


#### 🐲 Project stage: development

The Dissent-Voting application is still in development. If you are interested in contributing please see our open [issues](https://github.com/1hive/dissent-voting-app/issues).

#### 🚨 Security review status: pre-audit

The code in this repo has not been audited.

## How does it work?

Details on the mechanics of the Dandelion Voting and Dissent Oracle apps can be found in the README of each app:
- [Dandelion Voting README](https://github.com/1Hive/dissent-voting-app/tree/master/dandelion-voting/README.md)
- [Dissent Oracle README](https://github.com/1Hive/dissent-voting-app/tree/master/dissent-oracle/README.md)

## Aragon DAO Installation

Instructions for installation can be found in the README of each application.

## Contributing

We welcome community contributions!

Please check out our [open Issues](https://github.com/1Hive/time-lock-app/issues) to get started.

If you discover something that could potentially impact security, please notify us immediately. The quickest way to reach us is via the #dev channel in our [team Keybase chat](https://1hive.org/contribute/keybase). Just say hi and that you discovered a potential security vulnerability and we'll DM you to discuss details.

