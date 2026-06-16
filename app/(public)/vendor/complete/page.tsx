import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function VendorCompletePage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Already submitted</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-fg/70">This invoice request has already been submitted.</p>
        </CardContent>
      </Card>
    </div>
  );
}
