"use client"

import { useState, useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import axios from "axios"
import { format } from "date-fns"
import type { SelectSingleEventHandler } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"

type Shift = {
  date: Date
  pediatricAvailable: boolean
  adultAvailable: boolean
}

type AvailableShift = {
  date: Date
  providerType: "pediatric" | "adult"
}

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  shiftDates: z.array(z.string()).min(1, {
    message: "Please select at least one shift date.",
  }),
  providerType: z.enum(["pediatric", "adult"], {
    required_error: "Please select a provider type.",
  }),
  notes: z.string().optional(),
})

function ShiftSelector({
  date,
  onSave,
  currentShift,
}: {
  date: Date
  onSave: (shift: Shift) => void
  currentShift?: Shift
}) {
  const [pediatricAvailable, setPediatricAvailable] = useState(false)
  const [adultAvailable, setAdultAvailable] = useState(false)

  useEffect(() => {
    setPediatricAvailable(currentShift?.pediatricAvailable ?? false)
    setAdultAvailable(currentShift?.adultAvailable ?? false)
  }, [currentShift])

  return (
    <div className="p-4 space-y-4">
      <h3 className="font-semibold">Select available provider types for {format(date, "PPP")}</h3>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="pediatric"
          checked={pediatricAvailable}
          onCheckedChange={(checked: boolean) => setPediatricAvailable(checked)}
        />
        <label htmlFor="pediatric">Pediatric Provider</label>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="adult"
          checked={adultAvailable}
          onCheckedChange={(checked: boolean) => setAdultAvailable(checked)}
        />
        <label htmlFor="adult">Adult Provider</label>
      </div>
      <Button onClick={() => onSave({ date, pediatricAvailable, adultAvailable })}>Save</Button>
    </div>
  )
}

export default function ClinicSignupForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)

    const storedShifts = localStorage.getItem("clinicShifts")
    if (storedShifts) {
      try {
        const parsedShifts = JSON.parse(storedShifts).map((shift: any) => ({
          ...shift,
          date: new Date(shift.date),
        }))
        setShifts(parsedShifts)
      } catch (error) {
        console.error("Error parsing stored shifts:", error)
      }
    }

    const urlParams = new URLSearchParams(window.location.search)
    const adminParam = urlParams.get("admin")
    setIsAdmin(adminParam === "true")
  }, [])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      shiftDates: [],
      notes: "",
    },
  })

  const watchProviderType = form.watch("providerType")

  const availableShifts: AvailableShift[] = shifts
    .flatMap((shift) => {
      const availableShifts: AvailableShift[] = []
      if (shift.pediatricAvailable) {
        availableShifts.push({ date: shift.date, providerType: "pediatric" })
      }
      if (shift.adultAvailable) {
        availableShifts.push({ date: shift.date, providerType: "adult" })
      }
      return availableShifts
    })
    .filter((shift) => !watchProviderType || shift.providerType === watchProviderType)

  const handleDateSelect: SelectSingleEventHandler = (day) => {
    if (day) {
      setSelectedDate(day)
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true)
    try {
      await axios.post("https://formspree.io/f/xvgzjlea", {
        ...values,
        _cc: "chasecomprosky@ufl.edu",
      })

      setSubmitSuccess(true)
      form.reset()

      const updatedShifts = shifts.map((shift) => {
        const shiftDateString = shift.date.toISOString()
        if (values.shiftDates.includes(`${shiftDateString}-pediatric`)) {
          shift.pediatricAvailable = false
        }
        if (values.shiftDates.includes(`${shiftDateString}-adult`)) {
          shift.adultAvailable = false
        }
        return shift
      })
      setShifts(updatedShifts)
      localStorage.setItem("clinicShifts", JSON.stringify(updatedShifts))
    } catch (error) {
      console.error("Submission error:", error)
      setSubmitSuccess(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const addOrUpdateShift = (newShift: Shift) => {
    const existingShiftIndex = shifts.findIndex((shift) => shift.date.getTime() === newShift.date.getTime())
    let updatedShifts: Shift[]

    if (existingShiftIndex !== -1) {
      updatedShifts = shifts.map((shift, index) => (index === existingShiftIndex ? newShift : shift))
    } else {
      updatedShifts = [...shifts, newShift]
    }

    setShifts(updatedShifts)
    localStorage.setItem("clinicShifts", JSON.stringify(updatedShifts))
    setSelectedDate(undefined)
  }

  if (!isClient) {
    return null // Prevent hydration issues by not rendering anything on the server
  }

  if (submitSuccess) {
    return (
      <div className="max-w-md mx-auto mt-8 p-6 bg-green-100 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-green-800 mb-4">Thank You!</h2>
        <p className="text-green-700">Your sign-up for the clinic shift(s) has been successfully submitted.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">ClinicScheduler</h1>
      {isAdmin ? (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Manage Available Shifts</h2>
          <div className="flex flex-col space-y-4">
            <Calendar mode="single" selected={selectedDate} onSelect={handleDateSelect} className="rounded-md border" />
            {selectedDate && (
              <ShiftSelector
                date={selectedDate}
                onSave={addOrUpdateShift}
                currentShift={shifts.find((shift) => shift.date.getTime() === selectedDate.getTime())}
              />
            )}
          </div>
        </div>
      ) : null}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Dr. Jane Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="doctor@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="providerType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Provider Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="pediatric">Pediatric Provider</SelectItem>
                    <SelectItem value="adult">Adult Provider</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="shiftDates"
            render={() => (
              <FormItem>
                <FormLabel>Shift Dates</FormLabel>
                <div className="space-y-2">
                  {availableShifts.map((shift) => (
                    <div
                      key={`${shift.date.toISOString()}-${shift.providerType}`}
                      className="flex items-center space-x-2"
                    >
                      <Controller
                        name="shiftDates"
                        control={form.control}
                        render={({ field }) => (
                          <Checkbox
                            id={`${shift.date.toISOString()}-${shift.providerType}`}
                            checked={field.value?.includes(`${shift.date.toISOString()}-${shift.providerType}`)}
                            onCheckedChange={(checked: boolean) => {
                              const value = `${shift.date.toISOString()}-${shift.providerType}`
                              if (checked) {
                                field.onChange([...field.value, value])
                              } else {
                                field.onChange(field.value?.filter((v: string) => v !== value))
                              }
                            }}
                          />
                        )}
                      />
                      <label htmlFor={`${shift.date.toISOString()}-${shift.providerType}`}>
                        {format(shift.date, "PPP")} - {shift.providerType === "pediatric" ? "Pediatric" : "Adult"}
                      </label>
                    </div>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Additional Notes</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Any specific requirements or information..."
                    className="resize-none"
                    {...field}
                  />
                </FormControl>
                <FormDescription>Optional: Add any additional information or requests.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Sign Up for Shift(s)"}
          </Button>
        </form>
      </Form>
      {isAdmin && (
        <Button onClick={() => setIsAdmin(false)} className="mt-4 w-full" variant="outline">
          Switch to Provider View
        </Button>
      )}
    </div>
  )
}
