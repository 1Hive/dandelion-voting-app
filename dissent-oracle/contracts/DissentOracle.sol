pragma solidity ^0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";


contract DissentOracle is AragonApp {

    bytes32 public constant SET_DISSENT_WINDOW_ROLE = keccak256("SET_DISSENT_WINDOW_ROLE");

    function initialize() public onlyInit {
        initialized();
    }


}
