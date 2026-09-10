"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createTransportSchema, type CreateTransportDto } from "@/features/transport/schema";
import { CURRENCIES, type CurrencyCode } from "@/domain/money";
import { fetchWrapper } from "@/lib/client/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// Assume categories are fetched or passed in. For now, hardcoded or prop-based.
// We'll require categories to be passed as a prop from the page.
export function NewTransportForm({
  categories,
  baseCurrency,
}: {
  categories: { id: string; name: string }[];
  baseCurrency: CurrencyCode;
}) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<CreateTransportDto>({
    resolver: zodResolver(createTransportSchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      categoryId: "",
      currency: baseCurrency,
      morningAmount: "",
      eveningAmount: "",
      extraAmount: "",
      extraReason: "",
      notes: "",
      attachmentIds: [],
      idempotencyKey: crypto.randomUUID(),
    },
  });

  const extraAmount = watch("extraAmount");

  const onSubmit = async (data: CreateTransportDto) => {
    setSubmitError(null);
    try {
      const res = await fetchWrapper("/api/transport", {
        method: "POST",
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Failed to create transport log");
      }

      router.push("/transport");
      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "An unexpected error occurred");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
      {submitError && (
        <Alert variant="destructive">
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" {...register("date")} />
          {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="categoryId">Category</Label>
          <Controller
            name="categoryId"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger id="categoryId">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.categoryId && <p className="text-sm text-destructive">{errors.categoryId.message}</p>}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Amounts</h3>
        
        <div className="space-y-2 max-w-[200px]">
          <Label htmlFor="currency">Currency</Label>
          <Controller
            name="currency"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CURRENCIES).map(([code, def]) => (
                    <SelectItem key={code} value={code}>
                      {code} - {def.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="morningAmount">Morning Amount</Label>
            <Input id="morningAmount" type="text" placeholder="0.00" {...register("morningAmount")} />
            {errors.morningAmount && <p className="text-sm text-destructive">{errors.morningAmount.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="eveningAmount">Evening Amount</Label>
            <Input id="eveningAmount" type="text" placeholder="0.00" {...register("eveningAmount")} />
            {errors.eveningAmount && <p className="text-sm text-destructive">{errors.eveningAmount.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="extraAmount">Extra Amount</Label>
            <Input id="extraAmount" type="text" placeholder="0.00" {...register("extraAmount")} />
            {errors.extraAmount && <p className="text-sm text-destructive">{errors.extraAmount.message}</p>}
          </div>
        </div>
      </div>

      {extraAmount && extraAmount !== "0" && extraAmount.trim() !== "" && (
        <div className="space-y-2 border-l-2 border-primary pl-4">
          <Label htmlFor="extraReason">Reason for Extra Amount</Label>
          <Input id="extraReason" placeholder="Required when extra amount is provided" {...register("extraReason")} />
          {errors.extraReason && <p className="text-sm text-destructive">{errors.extraReason.message}</p>}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (Optional)</Label>
        <Textarea id="notes" placeholder="Any additional context..." {...register("notes")} />
        {errors.notes && <p className="text-sm text-destructive">{errors.notes.message}</p>}
      </div>

      <div className="flex justify-end space-x-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Log Transport"}
        </Button>
      </div>
    </form>
  );
}
