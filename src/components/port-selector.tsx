import React, { useEffect, useState } from "react";
import { Driver, WebSerialDriver } from "../drivers";

export function PortSelector({driver, setDriver}: {driver: Driver; setDriver: (d: Driver) => void}) {
  const [initializing, setInitializing] = useState(false)
  useEffect(() => {
    (async () => {
      try {
        const ports = await navigator.serial.getPorts()
        if (ports.length > 0) {
          console.log('connecting to', ports[0])
          // get the first
          setDriver(await WebSerialDriver.connect(ports[0]))
        }
      } finally {
        setInitializing(false)
      }
    })()
  }, [])
  return <>
    {driver ? `Connected: ${driver.name()}` : null}
    {!driver ?
      <button
        disabled={initializing}
        onClick={async () => {
          try {
            const port = await navigator.serial.requestPort({ filters: [{ usbVendorId: 0x04D8, usbProductId: 0xFD92 }] })
            if (driver)
              await driver.close()
            setDriver(await WebSerialDriver.connect(port))
          } catch (e) {
            alert(`Failed to connect to serial device: ${e.message}`)
            console.error(e)
          }
        }}
      >
        {/* TODO: allow changing port */}
        {initializing ? "Connecting..." : (driver ? "Change Port" : "Connect")}
      </button>
      : null}
  </>
}
