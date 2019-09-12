const DissentOracle = artifacts.require('DissentOracle.sol')
// TODO: Rename to DandelionVoting
const DandelionVoting = artifacts.require('VotingMock.sol')
const MiniMeToken = artifacts.require('MiniMeToken.sol')

const {deployedContract} = require("./helpers/helpers");
const {encodeCallScript} = require("@aragon/test-helpers/evmScript")
const {getLog} = require("./helpers/helpers")
const {hash} = require('eth-ens-namehash')
const deployDAO = require('./helpers/deployDAO')
const BN = require('bn.js')

const ANY_ADDRESS = '0xffffffffffffffffffffffffffffffffffffffff'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const bigExp = (x, y) => new BN(x).mul(new BN(10).pow(new BN(y)))
const pct16 = x => bigExp(x, 16)
const createdVoteId = receipt => getLog(receipt, 'StartVote', 'voteId')


// TODO: Split integration tests into a separate truffle project? Might be overkill, depends how many there are.
contract('DissentOracle', ([appManager, voter]) => {

    let dissentOracle, dissentOracleBase, dandelionVoting, dandelionVotingBase, voteToken
    let SET_DISSENT_VOTING_ROLE, SET_DISSENT_WINDOW_ROLE, CREATE_VOTES_ROLE
    let dao, acl

    const DISSENT_WINDOW = 60 * 60 * 24 // 1 day
    const VOTE_TOKEN_DECIMALS = 18

    const neededSupport = pct16(50)
    const minimumAcceptanceQuorum = pct16(20)
    const votingDuration = 1000

    before('deploy base apps', async () => {
        dissentOracleBase = await DissentOracle.new()
        SET_DISSENT_VOTING_ROLE = await dissentOracleBase.SET_DISSENT_VOTING_ROLE()
        SET_DISSENT_WINDOW_ROLE = await dissentOracleBase.SET_DISSENT_WINDOW_ROLE()

        dandelionVotingBase = await DandelionVoting.new()
        CREATE_VOTES_ROLE = await dandelionVotingBase.CREATE_VOTES_ROLE()
    })

    beforeEach('deploy dao and dissentOracle', async () => {
        const daoDeployment = await deployDAO(appManager)
        dao = daoDeployment.dao
        acl = daoDeployment.acl

        voteToken = await MiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'n', 0, 'n', true)

        const newDandelionVotingReceipt = await dao.newAppInstance(
            hash('dandelion-voting.aragonpm.test'), dandelionVotingBase.address, '0x', false, {from: appManager})
        dandelionVoting = await DandelionVoting.at(deployedContract(newDandelionVotingReceipt))

        const newDissentOracleReceipt = await dao.newAppInstance(
            hash('dissent-oracle.aragonpm.test'), dissentOracleBase.address, '0x', false, {from: appManager})
        dissentOracle = await DissentOracle.at(deployedContract(newDissentOracleReceipt))

        await acl.createPermission(appManager, dissentOracle.address, SET_DISSENT_WINDOW_ROLE, appManager, {from: appManager})
        await acl.createPermission(appManager, dissentOracle.address, SET_DISSENT_VOTING_ROLE, appManager, {from: appManager})
        await acl.createPermission(appManager, dandelionVoting.address, CREATE_VOTES_ROLE, appManager, {from: appManager})

        await dandelionVoting.initialize(voteToken.address, neededSupport, minimumAcceptanceQuorum, votingDuration)
    })

    describe("initialize(address _dandelionVoting, uint256 _dissentWindow)", async () => {

        beforeEach(async () => {
            // await dissentOracle.initialize(dandelionVoting.address, DISSENT_WINDOW)
        })

        it('should initialize with correct parameters', async () => {
            const actualDandelionVoting = await dissentOracle.dissentVoting()
            const actualDissentWindow = await dissentOracle.dissentWindow()

            assert.strictEqual(actualDandelionVoting, dandelionVoting.address)
            assert.equal(actualDissentWindow, DISSENT_WINDOW)
            assert.notStrictEqual(await dissentOracle.getInitializationBlock(), 0)
        })

        describe('setDandelionVoting(address _dandelionVoting)', () => {

            it('sets a new dandelion voting app', async () => {
                const newDandelionVotingReceipt = await dao.newAppInstance(
                    hash('dandelion-voting.aragonpm.test'), dandelionVotingBase.address, '0x', false, {from: appManager})
                const newDandelionVoting = await DandelionVoting.at(deployedContract(newDandelionVotingReceipt))

                await dissentOracle.setDissentVoting(newDandelionVoting.address)

                const actualDissentOracle = await dissentOracle.dissentVoting()
                assert.strictEqual(actualDissentOracle, newDandelionVoting.address)
            })
        })

        describe('setDissentWindow(uint256 _dissentWindow)', () => {

            it('sets a new dissent window', async () => {
                const expectedDissentWindow = 100

                await dissentOracle.setDissentWindow(expectedDissentWindow)

                const actualDissentWindow = await dissentOracle.dissentWindow()
                assert.equal(actualDissentWindow, expectedDissentWindow)
            })
        })

        describe('canPerform(address who, address where, bytes32 what, uint256[] how)', () => {

            let voteId

            beforeEach(async () => {
                await voteToken.generateTokens(voter, 10)
                voteId = createdVoteId(await dandelionVoting.newVote(encodeCallScript([]), ''))
            })

            it('returns true when last yea vote before dissent window', async () => {
                await dandelionVoting.vote(voteId, true, false, {from: voter})

            })

            it.only('returns false when last yea vote within dissent window', async () => {
                await dandelionVoting.vote(voteId, true, false, {from: voter})
                const actualCanPerform = await dissentOracle.canPerform(voter, ANY_ADDRESS, '0x', [])
                assert.isFalse(actualCanPerform)
            })
        })
    })
})
