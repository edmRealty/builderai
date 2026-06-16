import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function VendorExpiredPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Link expired</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-fg/70">This invoice upload link has expired. Please request a new link.</p>
        </CardContent>
      </Card>
    </div>
  );
}
