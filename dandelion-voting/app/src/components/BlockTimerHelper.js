import React from 'react'
import { Help } from '@aragon/ui'
import { useBlockTime } from '../hooks/useBlock'

const BlockTimerHelper = ({ vote }) => {
  const { upcoming, delayed, remainingBlocks } = vote.data
  const blockTime = useBlockTime()

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
        <Help hint="Why is this an estimated time?">
          This proposal has been approved but is subject to a{' '}
          <strong>delay</strong> before it can be enacted. Enactment will be
          available after <strong>{remainingBlocks}</strong> blocks
        </Help>
      ) : (
        <Help hint="Why is this an estimated time?">
          Vote start and end times are determined by blocks which occur
          approximately every <strong>{blockTime}</strong> seconds, the vote
          will
          {upcoming ? ' start ' : ' end '} in <strong>{remainingBlocks}</strong>{' '}
          blocks
        </Help>
      )}
    </div>
  )
}

export default BlockTimerHelper
