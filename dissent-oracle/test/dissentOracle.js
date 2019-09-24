const DissentOracle = artifacts.require('DissentOracleMock.sol')
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

contract('DissentOracle', ([appManager, voter, voter2]) => {

    let dissentOracle, dissentOracleBase, dandelionVoting, dandelionVotingBase, voteToken
    let SET_DANDELION_VOTING_ROLE, SET_DISSENT_WINDOW_ROLE, CREATE_VOTES_ROLE
    let dao, acl

    const DISSENT_WINDOW = 60 * 60 * 24 / 15 // 1 day in blocks
    const VOTE_TOKEN_DECIMALS = 18

    const neededSupport = pct16(50)
    const minimumAcceptanceQuorum = pct16(20)
    const voteDurationBlocks = 60 * 60 * 24 / 15 // 1 day in blocks
    const voteBufferBlocks = 100

    before('deploy base apps', async () => {
        dissentOracleBase = await DissentOracle.new()
        SET_DANDELION_VOTING_ROLE = await dissentOracleBase.SET_DANDELION_VOTING_ROLE()
        SET_DISSENT_WINDOW_ROLE = await dissentOracleBase.SET_DISSENT_WINDOW_ROLE()

        dandelionVotingBase = await DandelionVoting.new()
        CREATE_VOTES_ROLE = await dandelionVotingBase.CREATE_VOTES_ROLE()
    })

    beforeEach('deploy dao and dissentOracle', async () => {
        const daoDeployment = await deployDAO(appManager)
        dao = daoDeployment.dao
        acl = daoDeployment.acl

        voteToken = await MiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'n', VOTE_TOKEN_DECIMALS, 'n', true)

        const newDandelionVotingReceipt = await dao.newAppInstance(
            hash('dandelion-voting.aragonpm.test'), dandelionVotingBase.address, '0x', false, {from: appManager})
        dandelionVoting = await DandelionVoting.at(deployedContract(newDandelionVotingReceipt))

        const newDissentOracleReceipt = await dao.newAppInstance(
            hash('dissent-oracle.aragonpm.test'), dissentOracleBase.address, '0x', false, {from: appManager})
        dissentOracle = await DissentOracle.at(deployedContract(newDissentOracleReceipt))

        await acl.createPermission(appManager, dissentOracle.address, SET_DISSENT_WINDOW_ROLE, appManager, {from: appManager})
        await acl.createPermission(appManager, dissentOracle.address, SET_DANDELION_VOTING_ROLE, appManager, {from: appManager})
        await acl.createPermission(ANY_ADDRESS, dandelionVoting.address, CREATE_VOTES_ROLE, appManager, {from: appManager})

        await dandelionVoting.initialize(voteToken.address, neededSupport, minimumAcceptanceQuorum, voteDurationBlocks, voteBufferBlocks)
    })

    describe("initialize(address _dandelionVoting, uint64 _dissentWindowBlocks)", async () => {

        beforeEach(async () => {
            await dissentOracle.initialize(dandelionVoting.address, DISSENT_WINDOW)
        })

        it('should initialize with correct parameters', async () => {
            const actualDandelionVoting = await dissentOracle.dandelionVoting()
            const actualDissentWindow = await dissentOracle.dissentWindowBlocks()

            assert.strictEqual(actualDandelionVoting, dandelionVoting.address)
            assert.equal(actualDissentWindow, DISSENT_WINDOW)
            assert.notStrictEqual(await dissentOracle.getInitializationBlock(), 0)
        })

        describe('setDandelionVoting(address _dandelionVoting)', () => {

            it('sets a new dandelion voting app', async () => {
                const newDandelionVotingReceipt = await dao.newAppInstance(
                    hash('dandelion-voting.aragonpm.test'), dandelionVotingBase.address, '0x', false, {from: appManager})
                const newDandelionVoting = await DandelionVoting.at(deployedContract(newDandelionVotingReceipt))

                await dissentOracle.setDandelionVoting(newDandelionVoting.address)

                const actualDissentOracle = await dissentOracle.dandelionVoting()
                assert.strictEqual(actualDissentOracle, newDandelionVoting.address)
            })
        })

        describe('setDissentWindow(uint64 _dissentWindowBlocks)', () => {

            it('sets a new dissent window', async () => {
                const expectedDissentWindow = 100

                await dissentOracle.setDissentWindow(expectedDissentWindow)

                const actualDissentWindow = await dissentOracle.dissentWindowBlocks()
                assert.equal(actualDissentWindow, expectedDissentWindow)
            })
        })

        describe('canPerform(address _who, address _where, bytes32 _what, uint256[] _how)', () => {

            let voteId

            beforeEach(async () => {
                await voteToken.generateTokens(voter, bigExp(20, VOTE_TOKEN_DECIMALS))
                voteId = createdVoteId(await dandelionVoting.newVote(encodeCallScript([]), '', false), {from: appManager})
            })

            it('returns true when voted yea and dissent window passed', async () => {
                await dandelionVoting.vote(voteId, true, {from: voter})
                await dissentOracle.mockAdvanceBlocks(DISSENT_WINDOW)
                const actualCanPerform = await dissentOracle.canPerform(voter, ANY_ADDRESS, '0x', [])
                assert.isTrue(actualCanPerform)
            })

            it('returns false when voted yea and before end of dissent window', async () => {
                await dandelionVoting.vote(voteId, true, {from: voter})
                await dissentOracle.mockAdvanceBlocks(DISSENT_WINDOW - 2)
                const actualCanPerform = await dissentOracle.canPerform(voter, ANY_ADDRESS, '0x', [])
                assert.isFalse(actualCanPerform)
            })

            it('returns false when voted yea within dissent window', async () => {
                await dandelionVoting.vote(voteId, true, {from: voter})
                const actualCanPerform = await dissentOracle.canPerform(voter, ANY_ADDRESS, '0x', [])
                assert.isFalse(actualCanPerform)
            })

            it('returns true when voted no but within dissent window', async () => {
                await dandelionVoting.vote(voteId, false, {from: voter})
                const actualCanPerform = await dissentOracle.canPerform(voter, ANY_ADDRESS, '0x', [])
                assert.isTrue(actualCanPerform)
            })

            it('returns true when passed voter and dissent window in params and yea voter dissent window passed', async () => {
                const permissionParamsDissentWindow = DISSENT_WINDOW - 300
                await dandelionVoting.vote(voteId, true, {from: voter})
                await dissentOracle.mockAdvanceBlocks(permissionParamsDissentWindow)

                const actualCanPerform = await dissentOracle.canPerform(ANY_ADDRESS, ANY_ADDRESS, '0x', [voter, permissionParamsDissentWindow])

                assert.isTrue(actualCanPerform)
            })

            it('returns false when passed voter and dissent window in params and within yea voter dissent window', async () => {
                const permissionParamsDissentWindow = DISSENT_WINDOW - 300
                await dandelionVoting.vote(voteId, true, {from: voter})

                const actualCanPerform = await dissentOracle.canPerform(ANY_ADDRESS, ANY_ADDRESS, '0x', [voter, permissionParamsDissentWindow])

                assert.isFalse(actualCanPerform)
            })
        })
    })
})
