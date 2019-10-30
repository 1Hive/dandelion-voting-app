const { assertRevert } = require('@aragon/test-helpers/assertThrow')
const { assertAmountOfEvents } = require('@aragon/test-helpers/assertEvent')(web3)
const { getEventAt, getEventArgument, getNewProxyAddress } = require('@aragon/test-helpers/events')
const getBlockNumber = require('@aragon/test-helpers/blockNumber')(web3)
const { encodeCallScript, EMPTY_SCRIPT } = require('@aragon/test-helpers/evmScript')
const { makeErrorMappingProxy } = require('@aragon/test-helpers/utils')
const ExecutionTarget = artifacts.require('ExecutionTarget')

const Voting = artifacts.require('VotingMock')

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const DAOFactory = artifacts.require('DAOFactory')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')
const MiniMeToken = artifacts.require('MiniMeToken')

const bigExp = (x, y) => new web3.BigNumber(x).times(new web3.BigNumber(10).toPower(y))
const pct16 = x => bigExp(x, 16)
const createdVoteId = receipt => getEventArgument(receipt, 'StartVote', 'voteId')

const ANY_ADDR = '0xffffffffffffffffffffffffffffffffffffffff'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const VOTER_STATE = ['ABSENT', 'YEA', 'NAY'].reduce((state, key, index) => {
    state[key] = index;
    return state;
}, {})


contract('Voting App', ([root, holder1, holder2, holder20, holder29, holder51, nonHolder]) => {
    let votingBase, daoFact, voting, token, executionTarget

    let APP_MANAGER_ROLE
    let CREATE_VOTES_ROLE, MODIFY_SUPPORT_ROLE, MODIFY_QUORUM_ROLE, MODIFY_BUFFER_BLOCKS_ROLE, MODIFY_EXECUTION_DELAY_ROLE

    // Error strings
    const errors = makeErrorMappingProxy({
        // aragonOS errors
        APP_AUTH_FAILED: 'APP_AUTH_FAILED',
        INIT_ALREADY_INITIALIZED: 'INIT_ALREADY_INITIALIZED',
        INIT_NOT_INITIALIZED: 'INIT_NOT_INITIALIZED',
        RECOVER_DISALLOWED: 'RECOVER_DISALLOWED',

        // Voting errors
        VOTING_NO_VOTE: "VOTING_NO_VOTE",
        VOTING_INIT_PCTS: "VOTING_INIT_PCTS",
        VOTING_CHANGE_SUPPORT_PCTS: "VOTING_CHANGE_SUPPORT_PCTS",
        VOTING_CHANGE_QUORUM_PCTS: "VOTING_CHANGE_QUORUM_PCTS",
        VOTING_INIT_SUPPORT_TOO_BIG: "VOTING_INIT_SUPPORT_TOO_BIG",
        VOTING_CHANGE_SUPP_TOO_BIG: "VOTING_CHANGE_SUPP_TOO_BIG",
        VOTING_CAN_NOT_VOTE: "VOTING_CAN_NOT_VOTE",
        VOTING_CAN_NOT_EXECUTE: "VOTING_CAN_NOT_EXECUTE",
        VOTING_CAN_NOT_FORWARD: "VOTING_CAN_NOT_FORWARD"
    })

    const voteDurationBlocks = 500
    const bufferBlocks = 100
    const executionDelayBlocks = 200

    before(async () => {
        const kernelBase = await Kernel.new(true) // petrify immediately
        const aclBase = await ACL.new()
        const regFact = await EVMScriptRegistryFactory.new()
        daoFact = await DAOFactory.new(kernelBase.address, aclBase.address, regFact.address)
        votingBase = await Voting.new()

        // Setup constants
        APP_MANAGER_ROLE = await kernelBase.APP_MANAGER_ROLE()
        CREATE_VOTES_ROLE = await votingBase.CREATE_VOTES_ROLE()
        MODIFY_SUPPORT_ROLE = await votingBase.MODIFY_SUPPORT_ROLE()
        MODIFY_QUORUM_ROLE = await votingBase.MODIFY_QUORUM_ROLE()
        MODIFY_BUFFER_BLOCKS_ROLE = await votingBase.MODIFY_BUFFER_BLOCKS_ROLE()
        MODIFY_EXECUTION_DELAY_ROLE = await votingBase.MODIFY_EXECUTION_DELAY_ROLE()
    })

    beforeEach(async () => {
        const r = await daoFact.newDAO(root)
        const dao = Kernel.at(getEventArgument(r, 'DeployDAO', 'dao'))
        const acl = ACL.at(await dao.acl())

        await acl.createPermission(root, dao.address, APP_MANAGER_ROLE, root, { from: root })

        const receipt = await dao.newAppInstance('0x1234', votingBase.address, '0x', false, { from: root })
        voting = Voting.at(getNewProxyAddress(receipt))

        await acl.createPermission(ANY_ADDR, voting.address, CREATE_VOTES_ROLE, root, { from: root })
        await acl.createPermission(ANY_ADDR, voting.address, MODIFY_SUPPORT_ROLE, root, { from: root })
        await acl.createPermission(ANY_ADDR, voting.address, MODIFY_QUORUM_ROLE, root, { from: root })
        await acl.createPermission(ANY_ADDR, voting.address, MODIFY_BUFFER_BLOCKS_ROLE, root, { from: root })
        await acl.createPermission(ANY_ADDR, voting.address, MODIFY_EXECUTION_DELAY_ROLE, root, { from: root })
    })

    context('normal token supply, common tests', () => {
        const neededSupport = pct16(50)
        const minimumAcceptanceQuorum = pct16(20)

        beforeEach(async () => {
            token = await MiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'n', 0, 'n', true) // empty parameters minime

            await voting.initialize(token.address, neededSupport, minimumAcceptanceQuorum, voteDurationBlocks, bufferBlocks, executionDelayBlocks)

            executionTarget = await ExecutionTarget.new()
        })

        it('fails on reinitialization', async () => {
            await assertRevert(voting.initialize(token.address, neededSupport, minimumAcceptanceQuorum, voteDurationBlocks, bufferBlocks, executionDelayBlocks), errors.INIT_ALREADY_INITIALIZED)
        })

        it('cannot initialize base app', async () => {
            const newVoting = await Voting.new()
            assert.isTrue(await newVoting.isPetrified())
            await assertRevert(newVoting.initialize(token.address, neededSupport, minimumAcceptanceQuorum, voteDurationBlocks, bufferBlocks, executionDelayBlocks), errors.INIT_ALREADY_INITIALIZED)
        })

        it('checks it is forwarder', async () => {
            assert.isTrue(await voting.isForwarder())
        })

        it('can change required support', async () => {
            const receipt = await voting.changeSupportRequiredPct(neededSupport.add(1))
            assertAmountOfEvents(receipt, 'ChangeSupportRequired')

            assert.equal((await voting.supportRequiredPct()).toString(), neededSupport.add(1).toString(), 'should have changed required support')
        })

        it('fails changing required support lower than minimum acceptance quorum', async () => {
            await assertRevert(voting.changeSupportRequiredPct(minimumAcceptanceQuorum.minus(1)), errors.VOTING_CHANGE_SUPPORT_PCTS)
        })

        it('fails changing required support to 100% or more', async () => {
            await assertRevert(voting.changeSupportRequiredPct(pct16(101)), errors.VOTING_CHANGE_SUPP_TOO_BIG)
            await assertRevert(voting.changeSupportRequiredPct(pct16(100)), errors.VOTING_CHANGE_SUPP_TOO_BIG)
        })

        it('can change minimum acceptance quorum', async () => {
            const receipt = await voting.changeMinAcceptQuorumPct(1)
            assertAmountOfEvents(receipt, 'ChangeMinQuorum')

            assert.equal(await voting.minAcceptQuorumPct(), 1, 'should have changed acceptance quorum')
        })

        it('fails changing minimum acceptance quorum to greater than min support', async () => {
            await assertRevert(voting.changeMinAcceptQuorumPct(neededSupport.plus(1)), errors.VOTING_CHANGE_QUORUM_PCTS)
        })

        it('can change vote buffer blocks', async () => {
            const expectedBufferBlocks = 30
            const receipt = await voting.changeVoteBufferBlocks(expectedBufferBlocks)
            assertAmountOfEvents(receipt, 'ChangeVoteBufferBlocks')

            assert.equal(await voting.voteBufferBlocks(), expectedBufferBlocks, 'should have changed buffer blocks')
        })

        it('can change execution delay blocks', async () => {
            const expectedExecutionDelayBlocks = 50
            const receipt = await voting.changeExecutionDelayBlocks(expectedExecutionDelayBlocks)
            assertAmountOfEvents(receipt, 'ChangeExecutionDelayBlocks')

            assert.equal(await voting.executionDelayBlocks(), expectedExecutionDelayBlocks, 'should have changed execution delay blocks')
        })

    })

    for (const decimals of [0, 2, 18, 26]) {
        context(`normal token supply, ${decimals} decimals`, () => {
            const neededSupport = pct16(50)
            const minimumAcceptanceQuorum = pct16(20)

            beforeEach(async () => {
                token = await MiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'n', decimals, 'n', true) // empty parameters minime

                await token.generateTokens(holder20, bigExp(20, decimals))
                await token.generateTokens(holder29, bigExp(29, decimals))
                await token.generateTokens(holder51, bigExp(51, decimals))

                await voting.initialize(token.address, neededSupport, minimumAcceptanceQuorum, voteDurationBlocks, bufferBlocks, executionDelayBlocks)

                executionTarget = await ExecutionTarget.new()
            })

            it('execution scripts can execute multiple actions', async () => {
                const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
                const script = encodeCallScript([action, action, action])
                const voteId = createdVoteId(await voting.newVote(script, '', true, { from: holder51 }))
                await voting.mockAdvanceBlocks(voteDurationBlocks + executionDelayBlocks)
                await voting.executeVote(voteId)
                assert.equal(await executionTarget.counter(), 3, 'should have executed multiple times')
            })

            it('execution script can be empty', async () => {
                await voting.newVote(encodeCallScript([]), '', true, { from: holder51 })
            })

            it('execution throws if any action on script throws', async () => {
                const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
                let script = encodeCallScript([action])
                script = script.slice(0, -2) // remove one byte from calldata for it to fail
                const voteId = createdVoteId(await voting.newVote(script, '', true, { from: holder51 }))
                await voting.mockAdvanceBlocks(voteDurationBlocks + executionDelayBlocks)
                await assertRevert(voting.executeVote(voteId))
            })

            it('forwarding creates vote', async () => {
                const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
                const script = encodeCallScript([action])
                const voteId = createdVoteId(await voting.forward(script, { from: holder51 }))
                assert.equal(voteId, 0, 'voting should have been created')
            })

            context('creating vote', () => {
                let script, voteId, creator, metadata

                beforeEach(async () => {
                    const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
                    script = encodeCallScript([action, action])

                    const receipt = await voting.newVote(script, 'metadata', false, { from: holder51 });
                    voteId = getEventArgument(receipt, 'StartVote', 'voteId')
                    creator = getEventArgument(receipt, 'StartVote', 'creator')
                    metadata = getEventArgument(receipt, 'StartVote', 'metadata')
                })

                it('has correct state', async () => {
                    const [isOpen, isExecuted, startBlock, executionBlock, snapshotBlock, supportRequired, minQuorum, y, n, execScript] = await voting.getVote(voteId)

                    assert.isTrue(isOpen, 'vote should be open')
                    assert.isFalse(isExecuted, 'vote should not be executed')
                    assert.equal(startBlock.toString(), await getBlockNumber(), 'start block should be correct')
                    assert.equal(executionBlock.toString(), startBlock.toNumber() + executionDelayBlocks + voteDurationBlocks, 'execution block should be correct')
                    assert.equal(creator, holder51, 'creator should be correct')
                    assert.equal(snapshotBlock.toString(), await getBlockNumber() - 1, 'snapshot block should be correct')
                    assert.equal(supportRequired.toString(), neededSupport.toString(), 'required support should be app required support')
                    assert.equal(minQuorum.toString(), minimumAcceptanceQuorum.toString(), 'min quorum should be app min quorum')
                    assert.equal(y, 0, 'initial yea should be 0')
                    assert.equal(n, 0, 'initial nay should be 0')
                    assert.equal(execScript, script, 'script should be correct')
                    assert.equal(metadata, 'metadata', 'should have returned correct metadata')
                    assert.equal(await voting.getVoterState(voteId, nonHolder), VOTER_STATE.ABSENT, 'nonHolder should not have voted')
                })

                it('fails getting a vote out of bounds', async () => {
                    await assertRevert(voting.getVote(voteId + 1), errors.VOTING_NO_VOTE)
                })

                it('changing required support does not affect vote required support', async () => {
                    await voting.changeSupportRequiredPct(pct16(70))

                    // With previous required support at 50%, vote should be approved
                    // with new quorum at 70% it shouldn't have, but since min quorum is snapshotted
                    // it will succeed

                    await voting.vote(voteId, true, { from: holder51 })
                    await voting.vote(voteId, true, { from: holder20 })
                    await voting.vote(voteId, false, { from: holder29 })
                    await voting.mockAdvanceBlocks(voteDurationBlocks + executionDelayBlocks)

                    const state = await voting.getVote(voteId)
                    assert.equal(state[5].toString(), neededSupport.toString(), 'required support in vote should stay equal')
                    await voting.executeVote(voteId) // exec doesn't fail
                })

                it('changing min quorum doesnt affect vote min quorum', async () => {
                    await voting.changeMinAcceptQuorumPct(pct16(50))

                    // With previous min acceptance quorum at 20%, vote should be approved
                    // with new quorum at 50% it shouldn't have, but since min quorum is snapshotted
                    // it will succeed

                    await voting.vote(voteId, true, { from: holder29 })
                    await voting.mockAdvanceBlocks(voteDurationBlocks + executionDelayBlocks)

                    const state = await voting.getVote(voteId)
                    assert.equal(state[6].toString(), minimumAcceptanceQuorum.toString(), 'acceptance quorum in vote should stay equal')
                    await voting.executeVote(voteId) // exec doesn't fail
                })

                it('changing delay blocks doesnt affect vote delay blocks', async () => {
                    await voting.changeExecutionDelayBlocks(30)

                    await voting.vote(voteId, true, { from: holder29 })
                    await voting.mockAdvanceBlocks(voteDurationBlocks + executionDelayBlocks)

                    const state = await voting.getVote(voteId)
                    const expectedExecutionBlock = state[2].toNumber() + executionDelayBlocks + voteDurationBlocks
                    assert.equal(state[3].toString(), expectedExecutionBlock.toString(), 'execution blocks in vote should not change')
                    await voting.executeVote(voteId) // exec doesn't fail
                })

                it('holder can vote', async () => {
                    await voting.vote(voteId, false, { from: holder29 })
                    const state = await voting.getVote(voteId)
                    const voterState = await voting.getVoterState(voteId, holder29)

                    assert.equal(state[8].toString(), bigExp(29, decimals).toString(), 'nay vote should have been counted')
                    assert.equal(voterState, VOTER_STATE.NAY, 'holder29 should have nay voter status')
                })

                it('uses snapshot balance as vote weight when balance increases after vote start', async () => {
                    await token.generateTokens(holder29, bigExp(1, decimals))

                    await voting.vote(voteId, true, { from: holder29 })
                    const state = await voting.getVote(voteId)

                    const currentBalance = await token.balanceOf(holder29)
                    assert.equal(state[7].toString(), bigExp(29, decimals).toString(), 'snapshot balance should have been added')
                    assert.equal(currentBalance.toNumber(), bigExp(30, decimals).toNumber(), 'balance should be 30 at current block')
                })

                it('uses current balance as vote weight when balance decreases after vote start', async () => {
                    await token.transfer(nonHolder, bigExp(1, decimals), { from: holder29 })

                    await voting.vote(voteId, true, { from: holder29 })
                    const state = await voting.getVote(voteId)

                    const currentBalance = await token.balanceOf(holder29)
                    assert.equal(state[7].toString(), bigExp(28, decimals).toString(), 'current balance should have been added')
                    assert.equal(currentBalance.toNumber(), bigExp(28, decimals).toNumber(), 'balance should be 28 at current block')
                })

                it('throws when non-holder votes', async () => {
                    await assertRevert(voting.vote(voteId, true, { from: nonHolder }), errors.VOTING_CAN_NOT_VOTE)
                })

                it('throws when voting after voting closes', async () => {
                    await voting.mockAdvanceBlocks(voteDurationBlocks)
                    await assertRevert(voting.vote(voteId, true, { from: holder29 }), errors.VOTING_CAN_NOT_VOTE)
                })

                it("throws when voting before start block", async () => {
                    const newVoteId = createdVoteId(await voting.newVote(script, 'metadata', false, { from: holder51 }));
                    const [_newVoteOpen, _newVoteExecuted, newVoteStartBlock] = await voting.getVote(newVoteId)
                    const currentBlock = await voting.getBlockNumberPublic()

                    assert(parseInt(newVoteStartBlock) > parseInt(currentBlock), "new vote start block should be ahead of current block")

                    await assertRevert(voting.vote(newVoteId, true, { from: holder29 }), errors.VOTING_CAN_NOT_VOTE)
                })

                it('can execute if vote is approved with support and quorum and execution delay has passed', async () => {
                    await voting.vote(voteId, true, { from: holder29 })
                    await voting.vote(voteId, false, { from: holder20 })
                    await voting.mockAdvanceBlocks(voteDurationBlocks + executionDelayBlocks)
                    await voting.executeVote(voteId)
                    assert.equal(await executionTarget.counter(), 2, 'should have executed result')
                })

                it('cannot execute vote if not enough quorum met', async () => {
                    await voting.vote(voteId, true, { from: holder20 })
                    await voting.mockAdvanceBlocks(voteDurationBlocks + executionDelayBlocks)
                    await assertRevert(voting.executeVote(voteId), errors.VOTING_CAN_NOT_EXECUTE)
                })

                it('cannot execute vote if not support met', async () => {
                    await voting.vote(voteId, false, { from: holder29 })
                    await voting.vote(voteId, false, { from: holder20 })
                    await voting.mockAdvanceBlocks(voteDurationBlocks + executionDelayBlocks)
                    await assertRevert(voting.executeVote(voteId), errors.VOTING_CAN_NOT_EXECUTE)
                })

                it('cannot execute vote before execution block', async () => {
                    // Due to the structure of TimeHelpersMock contract we must subtract the blocks created since vote creation when testing.
                    const blocksSinceVoteCreation = 4
                    await voting.vote(voteId, true, { from: holder29 })
                    await voting.vote(voteId, false, { from: holder20 })
                    await voting.mockAdvanceBlocks(voteDurationBlocks + executionDelayBlocks - blocksSinceVoteCreation)
                    await assertRevert(voting.executeVote(voteId), errors.VOTING_CAN_NOT_EXECUTE)
                })

                it('cannot execute vote before previous successful vote has executed', async () => {
                    await voting.vote(voteId, true, { from: holder51 })
                    await voting.mockAdvanceBlocks(bufferBlocks)
                    const newVoteId = createdVoteId(await voting.newVote(script, 'metadata', true, { from: holder51 }));
                    await voting.mockAdvanceBlocks(voteDurationBlocks + executionDelayBlocks)

                    await assertRevert(voting.executeVote(newVoteId), errors.VOTING_CAN_NOT_EXECUTE)
                })

                it('can execute vote once previous successful vote has executed', async () => {
                    await voting.vote(voteId, true, { from: holder51 })
                    await voting.mockAdvanceBlocks(bufferBlocks)
                    const newVoteId = createdVoteId(await voting.newVote(script, 'metadata', true, { from: holder51 }));
                    await voting.mockAdvanceBlocks(voteDurationBlocks + executionDelayBlocks)

                    await voting.executeVote(voteId)
                    await voting.executeVote(newVoteId)

                    assert.equal((await executionTarget.counter()).toNumber(), 4, 'should have executed script 4 times')
                })

                it('can execute vote if previous vote failed', async () => {
                    await voting.mockAdvanceBlocks(bufferBlocks)
                    const newVoteId = createdVoteId(await voting.newVote(script, 'metadata', true, { from: holder51 }));
                    await voting.mockAdvanceBlocks(voteDurationBlocks + executionDelayBlocks)

                    await voting.executeVote(newVoteId)

                    assert.equal((await executionTarget.counter()).toNumber(), 2, 'should have executed script 2 times')
                })

                it('cannot execute vote twice', async () => {
                    await voting.vote(voteId, true, { from: holder51 })
                    await voting.mockAdvanceBlocks(voteDurationBlocks + executionDelayBlocks)
                    await voting.executeVote(voteId)
                    await assertRevert(voting.executeVote(voteId), errors.VOTING_CAN_NOT_EXECUTE)
                })

                it('cannot execute unvoted finished vote', async () => {
                    await voting.mockAdvanceBlocks(voteDurationBlocks + executionDelayBlocks)
                    await assertRevert(voting.executeVote(voteId), errors.VOTING_CAN_NOT_EXECUTE)
                })

                it("voter can't change vote", async () => {
                    await voting.vote(voteId, true, { from: holder29 })
                    await assertRevert(voting.vote(voteId, false, { from: holder29 }), errors.VOTING_CAN_NOT_VOTE)
                })

                it('cannot execute unvoted vote before start block', async () => {
                    const newVoteId = createdVoteId(await voting.newVote(script, 'metadata', false, { from: holder51 }));
                    const [_newVoteOpen, _newVoteExecuted, newVoteStartBlock] = await voting.getVote(newVoteId)
                    const currentBlock = await voting.getBlockNumberPublic()

                    assert(parseInt(newVoteStartBlock) > parseInt(currentBlock), "new vote start block should be ahead of current block")
                    await assertRevert(voting.executeVote(newVoteId), errors.VOTING_CAN_NOT_EXECUTE)
                })

                it("sets second vote start and snapshot block correctly when vote created before vote buffer elapsed", async () => {
                    const [_currentVoteOpen, _currentVoteExecuted, currentVoteStartBlock] = await voting.getVote(voteId)
                    const expectedVoteStartBlock = parseInt(currentVoteStartBlock) + bufferBlocks

                    const newVoteId = createdVoteId(await voting.newVote(script, 'metadata', false, { from: holder51 }));

                    const [_newVoteOpen, _newVoteExecuted, newVoteStartBlock, _newVoteExecutionBlock, newVoteSnapshotBlock] = await voting.getVote(newVoteId)
                    assert.equal(newVoteStartBlock, expectedVoteStartBlock)
                    assert.equal(newVoteSnapshotBlock, expectedVoteStartBlock - 1)
                })

                it("sets third vote start and snapshot block correctly when all created within vote buffer", async () => {
                    const secondVoteId = createdVoteId(await voting.newVote(script, 'metadata', false, { from: holder51 }));
                    const [_currentVoteOpen, _currentVoteExecuted, secondVoteStartBlock] = await voting.getVote(secondVoteId)
                    const expectedVoteStartBlock = parseInt(secondVoteStartBlock) + bufferBlocks

                    const thirdVoteId = createdVoteId(await voting.newVote(script, 'metadata', false, { from: holder51 }));

                    const [_thirdVoteOpen, _thirdVoteExecuted, thirdVoteStartBlock, _thirdVoteExecutionBlock, thirdVoteSnapshotBlock] = await voting.getVote(thirdVoteId)
                    assert.equal(thirdVoteStartBlock, expectedVoteStartBlock)
                    assert.equal(thirdVoteSnapshotBlock, expectedVoteStartBlock - 1)
                })

                it("sets second vote start and snapshot block correctly when vote created after vote buffer elapsed", async () => {
                    const expectedVoteStartBlock = await getBlockNumber() + bufferBlocks + 1
                    await voting.mockAdvanceBlocks(bufferBlocks)

                    const newVoteId = createdVoteId(await voting.newVote(script, 'metadata', false, { from: holder51 }));

                    const [_newVoteOpen, _newVoteExecuted, newVoteStartBlock, _newVoteExecutionBlock, newVoteSnapshotBlock] = await voting.getVote(newVoteId)
                    assert.equal(newVoteStartBlock, expectedVoteStartBlock)
                    assert.equal(newVoteSnapshotBlock, expectedVoteStartBlock - 1)
                })

                it("last yea vote block for voter set to start block of vote voted for", async () => {
                    const [_isOpen, _isExecuted, startBlock] = await voting.getVote(voteId)

                    await voting.vote(voteId, true, { from: holder29 })

                    const actualLastYeaBlock = await voting.lastYeaVoteBlock(holder29)
                    assert.equal(actualLastYeaBlock.toString(), startBlock.toString())
                })

                describe("last yea vote on second vote", () => {

                    let secondVoteId, secondVoteStartBlock

                    beforeEach(async () => {
                        await voting.mockAdvanceBlocks(120)
                        const receipt = await voting.newVote(script, 'metadata', false, { from: holder20 });
                        secondVoteId = getEventArgument(receipt, 'StartVote', 'voteId')
                        secondVoteStartBlock = (await voting.getVote(secondVoteId))[2]
                    })

                    it("updates when voting on a second vote", async () => {
                        await voting.vote(voteId, true, { from: holder29 })
                        const [_isOpen, _isExecuted, firstVoteStartBlock] = await voting.getVote(voteId)

                        await voting.vote(secondVoteId, true, { from: holder29 })

                        const actualLastYeaBlock = await voting.lastYeaVoteBlock(holder29)
                        assert.equal(actualLastYeaBlock.toString(), secondVoteStartBlock.toString())
                        assert.notEqual(actualLastYeaBlock.toString(), firstVoteStartBlock.toString())
                    })

                    it("doesn't update when second vote start block before voted on vote start block", async () => {
                        await voting.vote(secondVoteId, true, { from: holder29 })
                        const [_isOpen, _isExecuted, firstVoteStartBlock] = await voting.getVote(voteId)

                        await voting.vote(voteId, true, { from: holder29 })

                        const actualLastYeaBlock = await voting.lastYeaVoteBlock(holder29)
                        assert.equal(actualLastYeaBlock.toString(), secondVoteStartBlock.toString())
                        assert.notEqual(actualLastYeaBlock.toString(), firstVoteStartBlock.toString())
                    })
                })
            })
        })
    }

    context('wrong initializations', () => {
        beforeEach(async() => {
            token = await MiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'n', 0, 'n', true) // empty parameters minime
        })

        it('fails if min acceptance quorum is greater than min support', async () => {
            const neededSupport = pct16(20)
            const minimumAcceptanceQuorum = pct16(50)
            await assertRevert(voting.initialize(token.address, neededSupport, minimumAcceptanceQuorum, voteDurationBlocks, bufferBlocks, executionDelayBlocks), errors.VOTING_INIT_PCTS)
        })

        it('fails if min support is 100% or more', async () => {
            const minimumAcceptanceQuorum = pct16(20)
            await assertRevert(voting.initialize(token.address, pct16(101), minimumAcceptanceQuorum, voteDurationBlocks, bufferBlocks, executionDelayBlocks), errors.VOTING_INIT_SUPPORT_TOO_BIG)
            await assertRevert(voting.initialize(token.address, pct16(100), minimumAcceptanceQuorum, voteDurationBlocks, bufferBlocks, executionDelayBlocks), errors.VOTING_INIT_SUPPORT_TOO_BIG)
        })
    })

    context('empty token', () => {
        const neededSupport = pct16(50)
        const minimumAcceptanceQuorum = pct16(20)

        beforeEach(async() => {
            token = await MiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'n', 0, 'n', true) // empty parameters minime

            await voting.initialize(token.address, neededSupport, minimumAcceptanceQuorum, voteDurationBlocks, bufferBlocks, executionDelayBlocks)
        })

        it('prevents voting if token has no holder', async () => {
            const voteId = createdVoteId(await voting.newVote(EMPTY_SCRIPT, 'metadata', true))

            const [canVote] = await voting.getVote(voteId)
            assert.isFalse(canVote)
            await assertRevert(voting.vote(voteId, true, { from: holder1 }), errors.VOTING_CAN_NOT_VOTE)
        })
    })

    context('token supply = 1', () => {
        const neededSupport = pct16(50)
        const minimumAcceptanceQuorum = pct16(20)

        beforeEach(async () => {
            token = await MiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'n', 0, 'n', true) // empty parameters minime

            await token.generateTokens(holder1, 1)

            await voting.initialize(token.address, neededSupport, minimumAcceptanceQuorum, voteDurationBlocks, bufferBlocks, executionDelayBlocks)
        })

        it('new vote cannot be executed after only possible voter has voted', async () => {
            // Account creating vote does not have any tokens and therefore doesn't vote
            const voteId = createdVoteId(await voting.newVote(EMPTY_SCRIPT, 'metadata', true))

            assert.isFalse(await voting.canExecute(voteId), 'vote cannot be executed')

            await voting.vote(voteId, true, { from: holder1 })

            const [isOpen, isExecuted] = await voting.getVote(voteId)

            assert.isTrue(isOpen, 'vote should be open')
            assert.isFalse(isExecuted, 'vote should not have been executed')
        })
    })

    context('token supply = 3', () => {
        const neededSupport = pct16(34)
        const minimumAcceptanceQuorum = pct16(20)

        beforeEach(async () => {
            token = await MiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'n', 0, 'n', true) // empty parameters minime

            await token.generateTokens(holder1, 1)
            await token.generateTokens(holder2, 2)

            await voting.initialize(token.address, neededSupport, minimumAcceptanceQuorum, voteDurationBlocks, bufferBlocks, executionDelayBlocks)
        })

        it('new vote cannot be executed before holder2 voting', async () => {
            const voteId = createdVoteId(await voting.newVote(EMPTY_SCRIPT, 'metadata', true))

            assert.isFalse(await voting.canExecute(voteId), 'vote cannot be executed')

            await voting.vote(voteId, true, { from: holder1 })
            await voting.vote(voteId, true, { from: holder2 })

            const [isOpen, isExecuted] = await voting.getVote(voteId)

            assert.isTrue(isOpen, 'vote should be open')
            assert.isFalse(isExecuted, 'vote should not have been executed')
        })

        it('creating vote as holder2 does not execute vote', async () => {
            const voteId = createdVoteId(await voting.newVote(EMPTY_SCRIPT, 'metadata', true, { from: holder2 }))
            const [isOpen, isExecuted] = await voting.getVote(voteId)

            assert.isTrue(isOpen, 'vote should be open')
            assert.isFalse(isExecuted, 'vote should not have been executed')
        })
    })

    context('changing token supply', () => {
        const neededSupport = pct16(50)
        const minimumAcceptanceQuorum = pct16(20)

        beforeEach(async () => {
            token = await MiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'n', 0, 'n', true) // empty parameters minime

            await token.generateTokens(holder1, 1)
            await token.generateTokens(holder2, 1)

            await voting.initialize(token.address, neededSupport, minimumAcceptanceQuorum, voteDurationBlocks, bufferBlocks, executionDelayBlocks)
        })

        it('uses the correct snapshot value if tokens are minted afterwards', async () => {
            // Create vote and afterwards generate some tokens
            const voteId = createdVoteId(await voting.newVote(EMPTY_SCRIPT, 'metadata', true))
            await token.generateTokens(holder2, 1)

            const [isOpen, isExecuted, startBlock, exectuionBlock, snapshotBlock] = await voting.getVote(voteId)

            // Generating tokens advanced the block by one
            assert.equal(snapshotBlock.toString(), await getBlockNumber() - 2, 'snapshot block should be correct')

        })

        it('uses the correct snapshot value if tokens are minted in the same block', async () => {
            // Create vote and generate some tokens in the same transaction
            // Requires the voting mock to be the token's owner
            await token.changeController(voting.address)
            const voteId = createdVoteId(await voting.newTokenAndVote(holder2, 1, 'metadata'))

            const [isOpen, isExecuted, startBlock, executionBlock, snapshotBlock] = await voting.getVote(voteId)

            assert.equal(snapshotBlock.toString(), await getBlockNumber() - 1, 'snapshot block should be correct')

        })
    })

    context('before init', () => {
        it('fails creating a vote before initialization', async () => {
            await assertRevert(voting.newVote(encodeCallScript([]), '', true), errors.APP_AUTH_FAILED)
        })

        it('fails to forward actions before initialization', async () => {
            const action = { to: executionTarget.address, calldata: executionTarget.contract.execute.getData() }
            const script = encodeCallScript([action])
            await assertRevert(voting.forward(script, { from: holder51 }), errors.VOTING_CAN_NOT_FORWARD)
        })
    })

    context('isValuePct unit test', async () => {
        it('tests total = 0', async () => {
            const result1 = await voting.isValuePct(0, 0, pct16(50))
            assert.equal(result1, false, "total 0 should always return false")
            const result2 = await voting.isValuePct(1, 0, pct16(50))
            assert.equal(result2, false, "total 0 should always return false")
        })

        it('tests value = 0', async () => {
            const result1 = await voting.isValuePct(0, 10, pct16(50))
            assert.equal(result1, false, "value 0 should false if pct is non-zero")
            const result2 = await voting.isValuePct(0, 10, 0)
            assert.equal(result2, false, "value 0 should return false if pct is zero")
        })

        it('tests pct ~= 100', async () => {
            const result1 = await voting.isValuePct(10, 10, pct16(100).minus(1))
            assert.equal(result1, true, "value 10 over 10 should pass")
        })

        it('tests strict inequality', async () => {
            const result1 = await voting.isValuePct(10, 20, pct16(50))
            assert.equal(result1, false, "value 10 over 20 should not pass for 50%")

            const result2 = await voting.isValuePct(pct16(50).minus(1), pct16(100), pct16(50))
            assert.equal(result2, false, "off-by-one down should not pass")

            const result3 = await voting.isValuePct(pct16(50).plus(1), pct16(100), pct16(50))
            assert.equal(result3, true, "off-by-one up should pass")
        })
    })
})
