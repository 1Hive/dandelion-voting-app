import { useEffect, useState, useMemo } from 'react'
import { useApi, useNetwork } from '@aragon/api-react'

import usePromise from '../hooks/usePromise'
import { loadBlockTimestamp } from '../web3-utils'

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

export function useBlockNumber(updateEvery = 1000) {
  const [blockNumber, setBlockNumber] = useState(0)
  const api = useApi()
  useEffect(() => {
    const timer = setInterval(async () => {
      setBlockNumber(await api.web3Eth('getBlockNumber').toPromise())
    }, updateEvery)

    return () => {
      clearInterval(timer)
    }
  }, [api, updateEvery])

  return blockNumber
}

export function useBlockTimeStamp(endBlock) {
  const api = useApi()
  const endBlockTimestampPromise = useMemo(
    () => loadBlockTimestamp(api, endBlock),
    [api, endBlock]
  )
  return usePromise(() => endBlockTimestampPromise, [], 0)
}
