// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
contract EvidenceRegistry {
    struct Record { address author; uint256 timestamp; bytes32 previous; }
    mapping(bytes32 => Record) public records;
    event Anchored(bytes32 indexed digest, address indexed author, bytes32 indexed previous, uint256 timestamp);
    function anchor(bytes32 digest, bytes32 previous) external {
        require(digest != bytes32(0), "Empty digest");
        require(records[digest].author == address(0), "Already anchored");
        if (previous != bytes32(0)) {
            require(records[previous].author == msg.sender, "Unknown or unauthorized parent");
        }
        records[digest] = Record(msg.sender, block.timestamp, previous);
        emit Anchored(digest, msg.sender, previous, block.timestamp);
    }
}
