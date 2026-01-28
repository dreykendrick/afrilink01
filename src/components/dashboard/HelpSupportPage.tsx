import { useState } from 'react';
import { 
  ArrowLeft, 
  HelpCircle, 
  MessageSquare, 
  FileText, 
  Mail,
  Phone,
  ChevronDown,
  ChevronRight,
  Search,
  ExternalLink,
  Send,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { User } from '@/types';
import { toast } from 'sonner';

interface HelpSupportPageProps {
  currentUser: User;
  onBack: () => void;
}

const faqs = [
  {
    question: "How do I become a verified vendor?",
    answer: "To become a verified vendor, go to your Verification Status page and complete all verification steps including email verification, phone verification, and photo ID upload. Once submitted, our admin team will review your application within 24-48 hours."
  },
  {
    question: "How do commissions work for affiliates?",
    answer: "As an affiliate, you earn a commission on every sale made through your unique referral link. The commission rate varies by product and is set by the vendor. You can track your earnings in your dashboard and withdraw once you reach the minimum threshold."
  },
  {
    question: "How do I withdraw my earnings?",
    answer: "Go to your wallet section in the dashboard and click 'Withdraw'. You can choose from available payment methods including bank transfer and mobile money. Withdrawals are typically processed within 2-3 business days."
  },
  {
    question: "What products can I sell as a vendor?",
    answer: "You can sell both digital and physical products on AfriLink. All products must comply with our terms of service. Products go through an approval process before being listed on the marketplace."
  },
  {
    question: "How do I track my affiliate link performance?",
    answer: "Your dashboard shows real-time statistics including clicks, conversions, and earnings for each affiliate link. You can see which products are performing best and optimize your marketing strategy accordingly."
  },
  {
    question: "What if my verification is rejected?",
    answer: "If your verification is rejected, you'll receive a notification explaining why. Common reasons include unclear photos or mismatched information. You can update your documents and request a new verification from the Verification Status page."
  }
];

export const HelpSupportPage = ({ currentUser, onBack }: HelpSupportPageProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const filteredFaqs = faqs.filter(faq => 
    faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmitTicket = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setSending(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast.success('Support ticket submitted! We\'ll get back to you within 24 hours.');
    setSubject('');
    setMessage('');
    setSending(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack}
            className="rounded-xl hover:bg-secondary"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Help & Support</h1>
            <p className="text-sm text-muted-foreground">Get help and find answers</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="border-border bg-card hover:bg-card/80 transition-colors cursor-pointer">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-afrilink-blue/10 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-afrilink-blue" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Live Chat</h3>
                <p className="text-sm text-muted-foreground">Chat with support</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-border bg-card hover:bg-card/80 transition-colors cursor-pointer">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-afrilink-green/10 flex items-center justify-center">
                <Mail className="w-6 h-6 text-afrilink-green" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Email Us</h3>
                <p className="text-sm text-muted-foreground">support@afrilink.com</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-border bg-card hover:bg-card/80 transition-colors cursor-pointer">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-afrilink-purple/10 flex items-center justify-center">
                <Phone className="w-6 h-6 text-afrilink-purple" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Call Us</h3>
                <p className="text-sm text-muted-foreground">+1 (555) 123-4567</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Section */}
        <Card className="border-border bg-card mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary" />
              Frequently Asked Questions
            </CardTitle>
            <CardDescription>Find quick answers to common questions</CardDescription>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search FAQs..."
                className="pl-10 bg-secondary/50"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {filteredFaqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left hover:no-underline">
                    <span className="font-medium text-foreground">{faq.question}</span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            
            {filteredFaqs.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No matching FAQs found</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact Form */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Submit a Support Ticket
            </CardTitle>
            <CardDescription>Can't find what you're looking for? Send us a message</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What do you need help with?"
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your issue in detail..."
                className="bg-secondary/50 min-h-[150px]"
              />
            </div>
            <Button 
              onClick={handleSubmitTicket}
              disabled={sending}
              className="w-full sm:w-auto bg-gradient-primary hover:opacity-90"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Submit Ticket
            </Button>
          </CardContent>
        </Card>

        {/* Documentation Links */}
        <div className="mt-8 p-6 rounded-xl bg-gradient-to-br from-primary/10 via-transparent to-afrilink-purple/10 border border-border">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Documentation & Guides
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a href="#" className="flex items-center justify-between p-3 rounded-lg bg-background/50 hover:bg-background transition-colors group">
              <span className="text-sm text-foreground">Getting Started Guide</span>
              <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </a>
            <a href="#" className="flex items-center justify-between p-3 rounded-lg bg-background/50 hover:bg-background transition-colors group">
              <span className="text-sm text-foreground">Vendor Handbook</span>
              <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </a>
            <a href="#" className="flex items-center justify-between p-3 rounded-lg bg-background/50 hover:bg-background transition-colors group">
              <span className="text-sm text-foreground">Affiliate Marketing Tips</span>
              <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </a>
            <a href="#" className="flex items-center justify-between p-3 rounded-lg bg-background/50 hover:bg-background transition-colors group">
              <span className="text-sm text-foreground">Payment & Withdrawals</span>
              <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
