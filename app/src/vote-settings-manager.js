// This file is separated from vote-settings.js to ensure React
// doesn’t get included into the background script.
import React, { useContext } from 'react'
import { useAppState } from '@aragon/api-react'
import BN from 'bn.js'

const SettingsContext = React.createContext({
  pctBase: new BN(-1),
  durationBlocks: -1,
})

export const useSettings = () => useContext(SettingsContext)

export function SettingsProvider({ children }) {
  const { pctBase, durationBlocks } = useAppState()
  return (
    <SettingsContext.Provider value={{ pctBase, durationBlocks }}>
      {children}
    </SettingsContext.Provider>
  )
}
