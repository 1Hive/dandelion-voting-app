import React from 'react'
import {
  Bar,
  DropDown,
  Tag,
  GU,
  textStyle,
  useLayout,
  useTheme,
  Split,
  Box,
  IconTime,
  _DateRange as DateRange
} from '@aragon/ui'
import { format } from 'date-fns'
import EmptyFilteredVotes from '../components/EmptyFilteredVotes'
import VoteCard from '../components/VoteCard/VoteCard'
import VoteCardGroup from '../components/VoteCard/VoteCardGroup'

const sortVotes = (a, b) => {
  const dateDiff = b.data.endDate - a.data.endDate
  // Order by descending voteId if there's no end date difference
  return dateDiff !== 0 ? dateDiff : b.voteId - a.voteId
}

const useVotes = votes => {
  const sortedVotes = votes.sort(sortVotes)
  const openVotes = sortedVotes.filter(vote => vote.data.open)
  const pendingVotes = sortedVotes.filter(vote => vote.data.pending)
  const closedVotes = sortedVotes.filter(
    vote => !pendingVotes.includes(vote) && !openVotes.includes(vote)
  )
  return { openVotes, pendingVotes, closedVotes }
}

const Votes = React.memo(function Votes({
  votes,
  selectVote,
  executionTargets,
  filteredVotes,
  voteStatusFilter,
  handleVoteStatusFilterChange,
  voteOutcomeFilter,
  handleVoteOutcomeFilterChange,
  voteTrendFilter,
  handleVoteTrendFilterChange,
  voteAppFilter,
  handleVoteAppFilterChange,
  voteDateRangeFilter,
  handleVoteDateRangeFilterChange,
  handleClearFilters,
  lastTimeVotedYes
}) {
  const theme = useTheme()
  const { layoutName } = useLayout()
  const { openVotes, pendingVotes, closedVotes } = useVotes(filteredVotes)
  const formatDate = date => `${format(date, 'do MMM yy, HH:mm')} UTC`

  const multipleOfTarget = executionTargets.reduce((map, { name }) => {
    map.set(name, map.has(name))
    return map
  }, new Map())

  return (
    <React.Fragment>
      {layoutName !== 'small' && (
        <Bar>
          <div
            css={`
              height: ${8 * GU}px;
              display: grid;
              grid-template-columns: auto auto auto 1fr;
              grid-gap: ${1 * GU}px;
              align-items: center;
              padding-left: ${3 * GU}px;
            `}
          >
            <DropDown
              header='Status'
              placeholder='Status'
              selected={voteStatusFilter}
              onChange={handleVoteStatusFilterChange}
              items={[
                <div>
                  All
                  <span
                    css={`
                      margin-left: ${1.5 * GU}px;
                      display: inline-flex;
                      align-items: center;
                      justify-content: center;
                      color: ${theme.info};
                      ${textStyle('label3')};
                    `}
                  >
                    <Tag limitDigits={4} label={votes.length} size='small' />
                  </span>
                </div>,
                'Open',
                'Upcoming',
                'Closed'
              ]}
              width='128px'
            />
            {voteStatusFilter === 1 && (
              <DropDown
                header='Trend'
                placeholder='Trend'
                selected={voteTrendFilter}
                onChange={handleVoteTrendFilterChange}
                items={['All', 'Will pass', 'Won’t pass']}
                width='128px'
              />
            )}
            {voteStatusFilter !== 1 && (
              <DropDown
                header='Outcome'
                placeholder='Outcome'
                selected={voteOutcomeFilter}
                onChange={handleVoteOutcomeFilterChange}
                items={['All', 'Passed', 'Rejected', 'Enacted', 'Pending']}
                width='128px'
              />
            )}
            <DropDown
              header='App'
              placeholder='App'
              selected={voteAppFilter}
              onChange={handleVoteAppFilterChange}
              items={[
                'All',
                <ThisVoting showTag={multipleOfTarget.get('Voting')} />,
                ...executionTargets.map(
                  ({ name, identifier }) =>
                    `${name}${
                      multipleOfTarget.get(name) && identifier
                        ? ` (${identifier})`
                        : ''
                    }`
                ),
                'External'
              ]}
              width='128px'
            />
            <DateRange
              startDate={voteDateRangeFilter.start}
              endDate={voteDateRangeFilter.end}
              onChange={handleVoteDateRangeFilterChange}
            />
          </div>
        </Bar>
      )}
      <Split
        primary={
          <React.Fragment>
            {!filteredVotes.length ? (
              <EmptyFilteredVotes onClear={handleClearFilters} />
            ) : (
              <VoteGroups
                openVotes={openVotes}
                pendingVotes={pendingVotes}
                closedVotes={closedVotes}
                onSelectVote={selectVote}
              />
            )}
          </React.Fragment>
        }
        secondary={
          <React.Fragment>
            <Box
              css={`
                margin-top: ${6 * GU}px;
              `}
              heading='Last time Yes'
            >
              <React.Fragment>
                <div
                  css={`
                    margin-top: ${1 * GU}px;
                    display: inline-grid;
                    grid-template-columns: auto auto;
                    grid-gap: ${1 * GU}px;
                    align-items: center;
                    color: ${theme.surfaceContentSecondary};
                    ${textStyle('body2')};
                  `}
                >
                  <IconTime size='small' />
                  {lastTimeVotedYes
                    ? formatDate(lastTimeVotedYes)
                    : 'No record'}
                </div>
              </React.Fragment>
            </Box>
          </React.Fragment>
        }
      />
    </React.Fragment>
  )
})

const ThisVoting = ({ showTag }) => (
  <div
    css={`
      display: flex;
      align-items: center;
    `}
  >
    Voting
    {showTag && (
      <Tag
        size='small'
        css={`
          margin-left: ${1 * GU}px;
        `}
      >
        this app
      </Tag>
    )}
  </div>
)

const VoteGroups = React.memo(
  ({ openVotes, pendingVotes, closedVotes, onSelectVote }) => {
    const voteGroups = [
      ['Open votes', openVotes],
      ['Upcoming votes', pendingVotes],
      ['Closed votes', closedVotes]
    ]

    return (
      <React.Fragment>
        {voteGroups.map(([groupName, votes]) =>
          votes.length ? (
            <VoteCardGroup
              title={groupName}
              count={votes.length}
              key={groupName}
            >
              {votes.map(vote => (
                <VoteCard key={vote.voteId} vote={vote} onOpen={onSelectVote} />
              ))}
            </VoteCardGroup>
          ) : null
        )}
      </React.Fragment>
    )
  }
)

export default Votes
