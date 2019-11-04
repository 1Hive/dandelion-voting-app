import { useMemo } from 'react'
import { useApi, useNetwork } from '@aragon/api-react'

import usePromise from './usePromise'
import useNow from './useNow'
import { loadBlockTimestamp, loadBlockNumber } from '../web3-utils'

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

export function useBlockNumber() {
  const api = useApi()
  const now = useNow()

  const blockNumberPromise = useMemo(() => {
    return loadBlockNumber(api)
  }, [api, now]) // eslint-disable-line react-hooks/exhaustive-deps
  return usePromise(blockNumberPromise, [], 0)
}

export function useBlockTimeStamp(endBlock, closed) {
  const api = useApi()
  const endBlockTimestampPromise = useMemo(() => {
    return closed ? loadBlockTimestamp(api, endBlock) : dummyFn
  }, [api, closed, endBlock])
  return usePromise(endBlockTimestampPromise, [], 0)
}

const dummyFn = async () => {
  return 0
}
