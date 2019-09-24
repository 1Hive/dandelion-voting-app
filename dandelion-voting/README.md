# dandelion-voting
The Dandelion Voting app is a fork of the Aragon Voting app with some modifications:

- It records the last time a voter voted in favour of a vote.
- It removes the ability to recast votes.
- It removes the ability to execute votes until they have ended.
- It adds a buffer time between votes preventing new votes from starting until the buffer time has passed.
- Vote lengths are defined in numbers of blocks instead of time.

It is expected to be used with a non-transferrable token.


### Running tests

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