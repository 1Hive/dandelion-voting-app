# dissent-app
The dissent app enables organizations to restrict actions to only those who have not expressed approval in recent votes.

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
