"use client";

import { PageHeading } from "@/components/page-heading";
import { RecordForm } from "@/components/record-form";
import { Card, CardContent } from "@/components/ui/card";

export default function UploadPage() {
  return (
    <div>
      <PageHeading
        eyebrow="Protect"
        title="New protected record"
        description="Fill in a record, attach an access policy, and protect it. The clinical notes are encrypted with post-quantum cryptography and the policy is sealed inside the ciphertext — enforced before anyone can decrypt it."
      />
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="py-6">
            <RecordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
