import React from 'react'
import { Help } from '@aragon/ui'
import useBlockNumber from '../hooks/useBlockNumber'

const BlockTimerHelper = ({ vote, blockTime }) => {
  const { data } = vote
  const { endBlock, pending, startBlock, delayed, executionBlock } = data
  const currentBlockNumber = useBlockNumber()
  const remainingBlocks = pending
    ? startBlock - currentBlockNumber
    : delayed
    ? executionBlock - currentBlockNumber
    : endBlock - currentBlockNumber

  return (
    <div
      onClick={event => {
        event.stopPropagation()
      }}
      css={`
        width: 20px;
        height: 20px;
      `}
    >
      {delayed ? (
        <Help hint='Why is this an estimated time?'>
          This proposal has been approved but is subject to a{' '}
          <strong>delay</strong> before it can be enacted. Enactment will be
          available after <strong>{remainingBlocks}</strong> blocks
        </Help>
      ) : (
        <Help hint='Why is this an estimated time?'>
          Vote start and end times are determined by blocks which occur
          approximately every <strong>{blockTime}</strong> seconds, the vote
          will
          {pending ? ' start ' : ' end '} in <strong>{remainingBlocks}</strong>{' '}
          blocks
        </Help>
      )}
    </div>
  )
}

export default BlockTimerHelper
