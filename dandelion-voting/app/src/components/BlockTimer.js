import React from "react";
import { textStyle, unselectable, Timer } from "@aragon/ui";
import useBlockNumber from "../hooks/useBlockNumber";

const BlockTimer = ({ vote, endDate }) => {
  const { data } = vote;
  const { endBlock, pending, startBlock } = data;
  const currentBlockNumber = useBlockNumber();
  const remainingBlocks = pending
    ? startBlock - currentBlockNumber
    : endBlock - currentBlockNumber;

  return (
    <div
      css={`
        display: inline-block;
        align-items: center;
        white-space: nowrap;
        ${unselectable()};
        ${textStyle("body2")};
      `}
    >
      <span
        css={`
          display: block;
        `}
      >
        {pending ? `Starts in: ` : `Ends in: `} {remainingBlocks}
      </span>
      {!pending && (
        <div
          css={`
            display: flex;
          `}
        >
          <span>{`Estimated: `}</span>
          <span>
            <Timer end={endDate} maxUnits={4} />
          </span>
        </div>
      )}
    </div>
  );
};

export default BlockTimer;
