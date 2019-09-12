pragma solidity ^0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/acl/IACLOracle.sol";
import "../../contracts/DissentVoting.sol";

// TODO: SafeMath
// TODO: Update "DissentVoting" to "DandelionVoting"
contract DissentOracle is AragonApp, IACLOracle {

    bytes32 public constant SET_DISSENT_VOTING_ROLE = keccak256("SET_DISSENT_VOTING_ROLE");
    bytes32 public constant SET_DISSENT_WINDOW_ROLE = keccak256("SET_DISSENT_WINDOW_ROLE");

    string private constant ERROR_NOT_CONTRACT = "DISSENT_ORACLE_NOT_CONTRACT";

    DissentVoting public dissentVoting;
    uint256 public dissentWindow;

    event DissentVotingSet(address dissentVoting);
    event DissentWindowSet(uint256 dissentWindow);

    /**
    * @notice Initialize the DissentOracle
    * @param _dissentVoting Dissent voting aragon app address
    * @param _dissentWindow Time from previous yea vote the oracle will approve a function call for
    */
    function initialize(address _dissentVoting, uint256 _dissentWindow) external onlyInit {
        require(isContract(_dissentVoting), ERROR_NOT_CONTRACT);

        dissentVoting = DissentVoting(_dissentVoting);
        dissentWindow = _dissentWindow;

        initialized();
    }

    /**
    * @notice Update the dissent voting app to `_dissentVoting`
    * @param _dissentVoting New dissent window
    */
    function setDissentVoting(address _dissentVoting) external auth(SET_DISSENT_VOTING_ROLE) {
        require(isContract(_dissentVoting), ERROR_NOT_CONTRACT);

        dissentVoting = DissentVoting(_dissentVoting);
        emit DissentVotingSet(_dissentVoting);
    }

    /**
    * @notice Update the dissent window to `_dissentWindow`
    * @param _dissentWindow New dissent window
    */
    function setDissentWindow(uint256 _dissentWindow) external auth(SET_DISSENT_WINDOW_ROLE) {
        dissentWindow = _dissentWindow;
        emit DissentWindowSet(_dissentWindow);
    }

    function canPerform(address who, address where, bytes32 what, uint256[] how) external view returns (bool) {
        return dissentVoting.lastYeaVoteTime(who) < now - dissentWindow;
    }

}
