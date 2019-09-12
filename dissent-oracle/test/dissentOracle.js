const DissentOracle = artifacts.require('DissentOracle.sol')
// TODO: Rename to DandelionVoting
const DandelionVoting = artifacts.require('DissentVoting.sol')
const MiniMeToken = artifacts.require('MiniMeToken.sol')

const {deployedContract} = require("./helpers/helpers");
const {hash} = require('eth-ens-namehash')
const deployDAO = require('./helpers/deployDAO')

const ANY_ADDRESS = '0xffffffffffffffffffffffffffffffffffffffff'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

// TODO: Split integration tests into a separate truffle project? Might be overkill, depends how many there are.
contract('DissentOracle', ([appManager, user]) => {

    let dissentOracle, dissentOracleBase, dandelionVoting, dandelionVotingBase, voteToken
    let SET_DISSENT_WINDOW_ROLE

    const DISSENT_WINDOW = 60 * 60 * 24 // 1 day

    before('deploy base apps', async () => {
        dissentOracleBase = await DissentOracle.new()
        SET_DISSENT_WINDOW_ROLE = await dissentOracleBase.SET_DISSENT_WINDOW_ROLE()

        dandelionVotingBase = await DandelionVoting.new()
        // What permissions do we need?
    })

    beforeEach('deploy dao and dissentOracle', async () => {
        const {dao, acl} = await deployDAO(appManager)

        voteToken = await MiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'n', 0, 'n', true)

        const newDandelionVotingReceipt = await dao.newAppInstance(
            hash('dandelion-voting.aragonpm.test'), dandelionVotingBase.address, '0x', false, {from: appManager})
        dandelionVoting = DandelionVoting.at(deployedContract(newDandelionVotingReceipt))

        const newDissentOracleReceipt = await dao.newAppInstance(
            hash('dissent-oracle.aragonpm.test'), dissentOracleBase.address, '0x', false, {from: appManager})
        dissentOracle = DissentOracle.at(deployedContract(newDissentOracleReceipt))

        await acl.createPermission(ANY_ADDRESS, dissentOracle.address, SET_DISSENT_WINDOW_ROLE, appManager, {from: appManager})
    })

    describe("initialize()", async () => {

        beforeEach(async () => {
            await dissentOracle.initialize(dandelionVoting.address, DISSENT_WINDOW)
        })

        it('should initialize with correct parameters', async () => {
            const actualDandelionVoting = await dissentOracle.dissentVoting()
            const actualDissentWindow = await dissentOracle.dissentWindow()

            assert.strictEqual(actualDandelionVoting, dandelionVoting.address)
            assert.equal(actualDissentWindow, DISSENT_WINDOW)
            assert.notStrictEqual(await dissentOracle.getInitializationBlock(), 0)
        })
    })
})
