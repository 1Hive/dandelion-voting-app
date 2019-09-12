/* global artifacts contract beforeEach it assert */

const {assertRevert} = require('@aragon/test-helpers/assertThrow')
const {getEventArgument} = require('@aragon/test-helpers/events')
const {hash} = require('eth-ens-namehash')
const deployDAO = require('./helpers/deployDAO')

const DissentOracle = artifacts.require('DissentOracle.sol')

const ANY_ADDRESS = '0xffffffffffffffffffffffffffffffffffffffff'

contract('DissentOracle', ([appManager, user]) => {
    let dissentOracle, dissentOracleBase
    let SET_DISSENT_WINDOW_ROLE

    before('deploy base apps', async () => {
        dissentOracleBase = await DissentOracle.new()
        SET_DISSENT_WINDOW_ROLE = await dissentOracleBase.SET_DISSENT_WINDOW_ROLE()
    })

    beforeEach('deploy dao and dissentOracle', async () => {
        const {dao, acl} = await deployDAO(appManager)

        const newDissentOracleReceipt = await dao.newAppInstance(
            hash('dissent-oracle.aragonpm.test'), dissentOracleBase.address, '0x', false, {from: appManager})
        dissentOracle = DissentOracle.at(getEventArgument(newDissentOracleReceipt, 'NewAppProxy', 'proxy'))

        await acl.createPermission(ANY_ADDRESS, dissentOracle.address, SET_DISSENT_WINDOW_ROLE, appManager, {from: appManager})
    })

    describe("initialize()", async () => {

        beforeEach(async () => {
            await dissentOracle.initialize()
        })

        it('should be initialized', async () => {
            assert.notEqual(await dissentOracle.getInitializationBlock(), 0)
        })
    })
})
