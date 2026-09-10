"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchWrapper } from "@/lib/client/api";
import type { TransportLog } from "@/domain/models";
import { formatMoney } from "@/domain/money";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

export function TransportDetail({ id, isSuperAdmin }: { id: string; isSuperAdmin: boolean }) {
  const router = useRouter();
  const [log, setLog] = useState<TransportLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archiveReason, setArchiveReason] = useState("");
  const [archiving, setArchiving] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWrapper(`/api/transport/${id}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("Transport log not found");
        throw new Error("Failed to load details");
      }
      setLog(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading data");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleArchive = async () => {
    if (!log) return;
    if (!archiveReason.trim()) {
      alert("Please provide a reason for archiving");
      return;
    }
    
    setArchiving(true);
    try {
      const res = await fetchWrapper(`/api/transport/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "archive",
          reason: archiveReason,
          expectedRevision: log.revision,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Failed to archive");
      }
      
      await fetchDetail();
      setArchiveReason("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Archive failed");
    } finally {
      setArchiving(false);
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground p-4">Loading details...</div>;
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>;
  if (!log) return null;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Transport Log Details</h2>
        <Button variant="outline" onClick={() => router.back()}>Back</Button>
      </div>

      {log.archivedAt && (
        <Alert variant="destructive" className="bg-destructive/10">
          <AlertDescription>
            This record was archived on {format(new Date(log.archivedAt), "PPpp")}. 
            Its financial effect has been reversed.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">Date</div>
              <div className="font-medium">{log.date}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Amount</div>
              <div className="text-xl font-bold">{formatMoney(log.originalAmountMinor, log.currency)}</div>
              {log.currency !== log.baseCurrency && (
                <div className="text-xs text-muted-foreground mt-1">
                  Posted as {formatMoney(log.baseAmountMinor, log.baseCurrency)} (Rate: {log.exchangeRateSnapshot})
                </div>
              )}
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Category</div>
              <div className="font-medium">{log.categoryId}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Amount Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Morning</span>
              <span className="font-medium">{formatMoney(log.morningAmountMinor, log.currency)}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Evening</span>
              <span className="font-medium">{formatMoney(log.eveningAmountMinor, log.currency)}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Extra</span>
              <span className="font-medium">{formatMoney(log.extraAmountMinor, log.currency)}</span>
            </div>
            {log.extraAmountMinor > 0 && (
              <div className="pt-2">
                <span className="text-sm text-muted-foreground block">Extra Reason</span>
                <span className="text-sm font-medium">{log.extraReason}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Metadata & Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             {log.notes && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Notes</div>
                <div className="text-sm bg-muted p-3 rounded-md whitespace-pre-wrap">{log.notes}</div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground block">Created By</span>
                <span>{log.createdBy}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Created At</span>
                <span>{format(new Date(log.createdAt), "PPpp")}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Revision</span>
                <span>{log.revision}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Visibility</span>
                <span>{log.visibleToUserIds.length} user(s)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isSuperAdmin && !log.archivedAt && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-end gap-4 max-w-lg">
              <div className="flex-1 space-y-2 w-full">
                <Label htmlFor="reason">Archive Reason</Label>
                <Input 
                  id="reason"
                  placeholder="Reason for archiving..." 
                  value={archiveReason} 
                  onChange={e => setArchiveReason(e.target.value)}
                />
              </div>
              <Button 
                variant="destructive" 
                onClick={handleArchive} 
                disabled={archiving || !archiveReason.trim()}
              >
                {archiving ? "Archiving..." : "Archive Record"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Archiving immediately reverses the financial ledger posting. This action cannot be undone.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
