import React from "react";
import { textStyle, unselectable, Timer, Help } from "@aragon/ui";
import useBlockNumber from "../hooks/useBlockNumber";

const BlockTimerHelper = ({ vote, blockTime }) => {
  const { data } = vote;
  const { endBlock, pending, startBlock } = data;
  const currentBlockNumber = useBlockNumber();
  const remainingBlocks = pending
    ? startBlock - currentBlockNumber
    : endBlock - currentBlockNumber;

  return (
    <div
      onClick={event => {
        event.stopPropagation();
      }}
      css={`
        width: 20px;
        height: 20px;
      `}
    >
      <Help hint="Why is this an estimated time?">
        Vote start and end times are determined by blocks which occur
        approximately every <strong>{blockTime}</strong> seconds, the vote will
        {pending ? "start " : "end "} in <strong>{remainingBlocks}</strong>{" "}
        blocks;
      </Help>
    </div>
  );
};

export default BlockTimerHelper;
