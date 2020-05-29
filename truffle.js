const TruffleConfig = require("@aragon/os/truffle-config")

// TODO: Increase to max possible.
TruffleConfig.solc.optimizer.runs = 500

module.exports = TruffleConfig