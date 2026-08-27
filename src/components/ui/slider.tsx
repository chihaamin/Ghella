import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

function Slider({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn(
        "relative flex w-full touch-none items-center select-none",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-[5px] w-full grow overflow-hidden rounded-full bg-chip">
        <SliderPrimitive.Range className="absolute h-full bg-leaf" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block size-[18px] rounded-full border-[3px] border-leaf bg-white shadow-sm transition-transform outline-none hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring/50" />
    </SliderPrimitive.Root>
  )
}

export { Slider }
