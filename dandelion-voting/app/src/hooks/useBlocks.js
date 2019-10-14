import { useMemo } from "react";
import useNow from "./useNow";
import { useApi } from "@aragon/api-react";

export default async function useBlocks() {
  const now = useNow();
  const api = useApi();
  const blockNumber = await api.web3Eth("getBlockNumber").toPromise();

  return [
    useMemo(() => {
      return blockNumber;
    }, [block]) // eslint-disable-line react-hooks/exhaustive-dep
  ];
}
