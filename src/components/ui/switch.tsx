import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-[17px] w-[30px] shrink-0 cursor-pointer items-center rounded-full transition-colors outline-none",
        "data-[state=checked]:bg-leaf data-[state=unchecked]:bg-sand-2",
        "focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-[13px] rounded-full bg-white transition-transform",
          "data-[state=checked]:translate-x-[15px] data-[state=unchecked]:translate-x-[2px]"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
