var DissentOracle = artifacts.require('./DissentOracle.sol')

module.exports = function (deployer) {
  deployer.deploy(DissentOracle)
}
