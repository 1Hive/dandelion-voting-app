/*
 * SPDX-License-Identitifer:    GPL-3.0-or-later
 *
 * This file requires contract dependencies which are licensed as
 * GPL-3.0-or-later, forcing it to also be licensed as such.
 *
 * This is the only file in your project that requires this license and
 * you are free to choose a different license for the rest of the project.
 */

pragma solidity 0.4.24;

import "@aragon/os/contracts/factory/DAOFactory.sol";
import "@aragon/os/contracts/apm/Repo.sol";
import "@aragon/os/contracts/lib/ens/ENS.sol";
import "@aragon/os/contracts/lib/ens/PublicResolver.sol";
import "@aragon/os/contracts/apm/APMNamehash.sol";
import "@aragon/apps-shared-minime/contracts/MiniMeToken.sol";
import "@aragon/apps-token-manager/contracts/TokenManager.sol";

import "../DissentVoting.sol";


contract TemplateBase is APMNamehash {
    ENS public ens;
    DAOFactory public fac;

    event DeployInstance(address dao);
    event InstalledApp(address appProxy, bytes32 appId);

    constructor(DAOFactory _fac, ENS _ens) public {
        ens = _ens;

        // If no factory is passed, get it from on-chain bare-kit
        if (address(_fac) == address(0)) {
            bytes32 bareKit = apmNamehash("bare-kit");
            fac = TemplateBase(latestVersionAppBase(bareKit)).fac();
        } else {
            fac = _fac;
        }
    }

    function latestVersionAppBase(bytes32 appId) public view returns (address base) {
        Repo repo = Repo(PublicResolver(ens.resolver(appId)).addr(appId));
        (,base,) = repo.getLatest();

        return base;
    }

    function installApp(Kernel dao, bytes32 appId) internal returns (address) {
        address instance = address(dao.newAppInstance(appId, latestVersionAppBase(appId)));
        emit InstalledApp(instance, appId);
        return instance;
    }

    function installDefaultApp(Kernel dao, bytes32 appId) internal returns (address) {
        address instance = address(dao.newAppInstance(appId, latestVersionAppBase(appId), new bytes(0), true));
        emit InstalledApp(instance, appId);
        return instance;
    }
}


contract Template is TemplateBase {
    MiniMeTokenFactory tokenFactory;

    uint64 constant PCT = 10 ** 16;
    address constant ANY_ENTITY = address(-1);

    uint8 constant ORACLE_PARAM_ID = 203;
    enum Op { NONE, EQ, NEQ, GT, LT, GTE, LTE, RET, NOT, AND, OR, XOR, IF_ELSE } // op types

    bytes32 internal DISSENT_APP_ID = keccak256(abi.encodePacked(apmNamehash("open"), keccak256("dissent-voting")));
    bytes32 internal TOKEN_MANAGER_APP_ID = apmNamehash("token-manager");

    constructor(ENS ens) TemplateBase(DAOFactory(0), ens) public {
        tokenFactory = new MiniMeTokenFactory();
    }

    function newInstance() public {
        Kernel dao = fac.newDAO(this);
        ACL acl = ACL(dao.acl());
        acl.createPermission(this, dao, dao.APP_MANAGER_ROLE(), this);

        address root = msg.sender;

        DissentVoting dissent = DissentVoting(installApp(dao,DISSENT_APP_ID));
        TokenManager tokenManager = TokenManager(installApp(dao,TOKEN_MANAGER_APP_ID));

        MiniMeToken token = tokenFactory.createCloneToken(MiniMeToken(0), 0, "Test token", 18, "TST", true);
        token.changeController(tokenManager);

        // Initialize apps
        dissent.initialize(token, 50 * PCT, 20 * PCT, 1 days, 30);  //initialize dissent-app with 30 seconds window
        tokenManager.initialize(token, true, 0);

        acl.createPermission(this, tokenManager, tokenManager.MINT_ROLE(), this);
        tokenManager.mint(root, 10e18); // Give ten tokens to root

        acl.createPermission(tokenManager, dissent, dissent.CREATE_VOTES_ROLE(), root);

        // creating param for dissent oracle (the idea here is when an entity tries to transfer tokens, it first checks with the oracle)
        setOracle(acl, ANY_ENTITY, tokenManager, tokenManager.BURN_ROLE(), dissent);

        // Clean up permissions
        acl.grantPermission(root, dao, dao.APP_MANAGER_ROLE());
        acl.revokePermission(this, dao, dao.APP_MANAGER_ROLE());
        acl.setPermissionManager(root, dao, dao.APP_MANAGER_ROLE());

        acl.grantPermission(root, acl, acl.CREATE_PERMISSIONS_ROLE());
        acl.revokePermission(this, acl, acl.CREATE_PERMISSIONS_ROLE());
        acl.setPermissionManager(root, acl, acl.CREATE_PERMISSIONS_ROLE());

        acl.grantPermission(dissent, tokenManager, tokenManager.MINT_ROLE());
        acl.revokePermission(this, tokenManager, tokenManager.MINT_ROLE());
        acl.setPermissionManager(root, tokenManager, tokenManager.MINT_ROLE());

        emit DeployInstance(dao);
    }

    function setOracle(ACL acl, address who, address where, bytes32 what, address oracle) internal {
        uint256[] memory params = new uint256[](1);
        params[0] = paramsTo256(ORACLE_PARAM_ID,uint8(Op.EQ),uint240(oracle));
        acl.grantPermissionP(who, where, what, params);
    }

    function paramsTo256(uint8 id,uint8 op, uint240 value) internal returns (uint256) {
        return (uint256(id) << 248) + (uint256(op) << 240) + value;
    }

}
