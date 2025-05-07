import { Link } from "wouter";

export default function TermsOfService() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
      
      <div className="prose prose-slate dark:prose-invert">
        <p className="text-lg mb-4">Last Updated: May 7, 2025</p>
        
        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">Agreement to Terms</h2>
          <p>
            By accessing or using the VadisMedia platform, you agree to be bound by these Terms and 
            Conditions. If you disagree with any part of the terms, you may not access the service.
          </p>
        </section>
        
        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">Subscription and Payments</h2>
          <p>
            Some aspects of our service may require a paid subscription. By choosing a paid subscription, 
            you agree to pay the subscription fees indicated. Fees are non-refundable except as required by law 
            or as explicitly stated in our refund policy.
          </p>
        </section>
        
        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">Intellectual Property</h2>
          <p>
            The VadisMedia platform and its original content, features, and functionality are owned by 
            VadisMedia and are protected by international copyright, trademark, patent, trade secret, 
            and other intellectual property laws.
          </p>
          <p className="mt-2">
            You retain all rights to the content you upload to our platform. However, by uploading content, 
            you grant us a non-exclusive, worldwide, royalty-free license to use, reproduce, and process that 
            content solely for the purpose of providing our services to you.
          </p>
        </section>
        
        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">User Content</h2>
          <p>
            You are solely responsible for the content you upload to our platform. You agree not to upload 
            content that is illegal, infringing, harmful, threatening, abusive, harassing, defamatory, vulgar, 
            obscene, or otherwise objectionable.
          </p>
        </section>
        
        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, VadisMedia, its directors, employees, partners, agents, 
            suppliers, or affiliates shall not be liable for any indirect, incidental, special, consequential, 
            or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other 
            intangible losses.
          </p>
        </section>
        
        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless VadisMedia, its officers, directors, employees, agents, 
            suppliers, and affiliates from and against any claims, liabilities, damages, losses, and expenses, 
            including without limitation reasonable attorney's fees, arising out of or in any way connected with 
            your access to or use of the service.
          </p>
        </section>
        
        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in 
            which VadisMedia is established, without regard to its conflict of law provisions.
          </p>
        </section>
        
        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">Changes to Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. We will provide notice of any significant 
            changes by posting the new Terms on this page and updating the "Last Updated" date.
          </p>
        </section>
        
        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">Contact Us</h2>
          <p>
            If you have any questions about these Terms, please <Link href="/contact" className="text-primary hover:underline">contact us</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}