pragma solidity ^0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/acl/IACLOracle.sol";
import "@aragon/os/contracts/lib/math/SafeMath64.sol";
import "../../dandelion-voting/contracts/DandelionVoting.sol";

contract DissentOracle is AragonApp, IACLOracle {

    using SafeMath64 for uint64;

    bytes32 public constant SET_DANDELION_VOTING_ROLE = keccak256("SET_DANDELION_VOTING_ROLE");
    bytes32 public constant SET_DISSENT_WINDOW_ROLE = keccak256("SET_DISSENT_WINDOW_ROLE");

    string private constant ERROR_NOT_CONTRACT = "DISSENT_ORACLE_NOT_CONTRACT";

    DandelionVoting public dandelionVoting;
    uint64 public dissentWindowBlocks;

    event DandelionVotingSet(address dandelionVoting);
    event DissentWindowBlocksSet(uint64 dissentWindowBlocks);

    /**
    * @notice Initialize the DissentOracle
    * @param _dandelionVoting Dissent voting aragon app address
    * @param _dissentWindowBlocks Blocks from previous yea vote the oracle will approve a function call for
    */
    function initialize(address _dandelionVoting, uint64 _dissentWindowBlocks) external onlyInit {
        require(isContract(_dandelionVoting), ERROR_NOT_CONTRACT);

        dandelionVoting = DandelionVoting(_dandelionVoting);
        dissentWindowBlocks = _dissentWindowBlocks;

        initialized();
    }

    /**
    * @notice Update the dissent voting app to `_dandelionVoting`
    * @param _dandelionVoting New dissent window
    */
    function setDandelionVoting(address _dandelionVoting) external auth(SET_DANDELION_VOTING_ROLE) {
        require(isContract(_dandelionVoting), ERROR_NOT_CONTRACT);

        dandelionVoting = DandelionVoting(_dandelionVoting);
        emit DandelionVotingSet(_dandelionVoting);
    }

    /**
    * @notice Update the dissent window to `_dissentWindowBlocks`
    * @param _dissentWindowBlocks New dissent window
    */
    function setDissentWindow(uint64 _dissentWindowBlocks) external auth(SET_DISSENT_WINDOW_ROLE) {
        dissentWindowBlocks = _dissentWindowBlocks;
        emit DissentWindowBlocksSet(_dissentWindowBlocks);
    }

    /**
    * @notice ACLOracle
    * @dev IACLOracle interface conformance. If the ACLOracle permissioned function uses a forwarder and needs to
    *      pass parameters, it should be used with the modifier 'authP(SOME_ACL_ROLE, arr(voter, dissentWindowBlocks))'
    */
    function canPerform(address _who, address _where, bytes32 _what, uint256[] _how) external view returns (bool) {

        address voter = _who;
        uint64 dissentWindowBlocksLocal = dissentWindowBlocks;

        if (_how.length > 0) {
            voter = address(_how[0]);
            dissentWindowBlocksLocal = uint64(_how[1]);
        }

        // We check hasNeverVotedYea for the edge case where the chains current block number is less than the
        // dissentWindowBlocks and canPerform would return false even if "who" has not voted, when it should return true.
        bool hasNeverVotedYea = dandelionVoting.lastYeaVoteBlock(voter) == 0;

        return dandelionVoting.lastYeaVoteBlock(voter).add(dissentWindowBlocksLocal) < getBlockNumber64() || hasNeverVotedYea;
    }

}
