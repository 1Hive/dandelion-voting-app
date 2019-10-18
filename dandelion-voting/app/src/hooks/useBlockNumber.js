import { useEffect, useState } from 'react'
import useNow from './useNow'
import { useApi } from '@aragon/api-react'

export default function useBlockNumber() {
  const [blockNumber, setBlockNumber] = useState()
  const now = useNow()
  const api = useApi()

  useEffect(() => {
    const fetchBlockNumber = async () => {
      const result = api && (await api.web3Eth('getBlockNumber').toPromise())
      setBlockNumber(result)
    }
    fetchBlockNumber()
  }, [api, now])

  return blockNumber
}
