import { useMemo, useState } from 'react'
import { useApi, useNetwork } from '@aragon/api-react'

import usePromise from './usePromise'
import useInterval from './useInterval'
import {
  loadBlockTimestamp,
  loadBlockNumber,
  loadBlockLatest,
} from '../web3-utils'

const NETWORK_TIMES = new Map([
  ['main', 13.5],
  ['kovan', 4],
  ['rinkeby', 14.5],
  ['ropsten', 11.5],
  ['goerli', 15],
  ['private', 3],
])
export function useBlockTime() {
  const network = useNetwork()

  return useMemo(() => (network ? NETWORK_TIMES.get(network.type) : null), [
    network,
  ])
}

export function useBlockLatest(updateEvery = 1000) {
  const api = useApi()
  const [block, setBlock] = useState({ number: 0, timeStamp: 0 })

  useInterval(
    async () => {
      const { number, timestamp } = api ? await loadBlockLatest(api) : block
      // Prevent unnecessary re-renders
      if (number !== block.number) setBlock({ number, timestamp })
    },
    updateEvery,
    true
  )

  return block
}

export function useBlockNumber(updateEvery = 1000) {
  const api = useApi()
  const [blockNumber, setBlockNumber] = useState(0)

  useInterval(async () => {
    setBlockNumber(await loadBlockNumber(api))
  }, updateEvery)

  return blockNumber
}

export function useBlockTimeStamp(blockNumber, load = false) {
  const api = useApi()
  const blockTimeStampPromise = useMemo(() => {
    return load ? loadBlockTimestamp(api, blockNumber) : dummyFn
  }, [api, blockNumber, load])
  return usePromise(blockTimeStampPromise, [], 0)
}

const dummyFn = async () => {
  return 0
}
