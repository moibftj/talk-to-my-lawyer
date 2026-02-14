import { Star, Quote, UserCheck } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"

const testimonials = [
  {
    name: "Sarah M.",
    role: "Small Business Owner",
    quote: "I was owed $15,000 from a client who refused to pay. Within a week of sending the demand letter, they agreed to a payment plan. Worth every penny.",
    rating: 5,
    initials: "SM",
    color: "bg-blue-100 text-blue-600",
  },
  {
    name: "James T.",
    role: "Freelance Contractor",
    quote: "The cease and desist letter stopped my former employer from violating my non-compete. Professional, fast, and far cheaper than hiring a lawyer directly.",
    rating: 5,
    initials: "JT",
    color: "bg-amber-100 text-amber-600",
  },
  {
    name: "Maria L.",
    role: "Property Manager",
    quote: "I've used Talk-to-my-Lawyer for multiple tenant disputes. The membership pays for itself after just one letter. The attorneys are thorough and responsive.",
    rating: 5,
    initials: "ML",
    color: "bg-emerald-100 text-emerald-600",
  },
]

export default function TestimonialsSection() {
  return (
    <section className="section-padding bg-white relative overflow-hidden">
      <div className="absolute top-0 right-0 w-1/3 h-full bg-slate-50/50 -skew-x-12 transform translate-x-1/2 pointer-events-none" />
      
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-20">
          <Badge className="bg-sky-50 text-legal-navy border-sky-100 mb-4 px-4 py-1">
            Client Success
          </Badge>
          <h2 className="legal-heading-lg mb-6">Trusted by Professionals</h2>
          <p className="legal-body-lg max-w-2xl mx-auto">
            Join thousands of clients who have successfully resolved their legal disputes with our attorney-drafted correspondence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.name}
              className="reveal-on-scroll"
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <Card className="legal-card h-full border-none shadow-xl shadow-slate-200/50 group">
                <CardContent className="pt-12 pb-10 px-8 relative">
                  <div className="absolute -top-6 left-8">
                    <div className={`h-12 w-12 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-sm font-bold ${testimonial.color}`}>
                      {testimonial.initials}
                    </div>
                  </div>
                  
                  <Quote className="h-10 w-10 text-legal-gold/10 absolute top-8 right-8" />
                  
                  <div className="flex gap-1 mb-6">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star
                        key={i}
                        className="h-4 w-4 fill-legal-gold text-legal-gold"
                      />
                    ))}
                  </div>
                  
                  <p className="text-slate-600 leading-relaxed italic mb-8 text-lg">
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>
                  
                  <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                    <div>
                      <p className="font-bold text-legal-navy text-lg">{testimonial.name}</p>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{testimonial.role}</p>
                    </div>
                    <UserCheck className="h-5 w-5 text-green-500/50" />
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
        
        <div className="mt-20 text-center">
          <div className="inline-flex items-center gap-8 p-4 bg-slate-50 rounded-full border border-slate-100">
            <div className="flex -space-x-3">
              {[
                { n: "JD", c: "bg-blue-100 text-blue-600" },
                { n: "AS", c: "bg-amber-100 text-amber-600" },
                { n: "MK", c: "bg-emerald-100 text-emerald-600" },
                { n: "RL", c: "bg-purple-100 text-purple-600" },
                { n: "BW", c: "bg-indigo-100 text-indigo-600" },
              ].map((user, i) => (
                <div key={i} className={`h-10 w-10 rounded-full border-2 border-white ${user.c} flex items-center justify-center text-xs font-bold shadow-sm`}>
                  {user.n}
                </div>
              ))}
            </div>
            <p className="text-sm font-bold text-slate-600">
              <span className="text-legal-navy">4.9/5 Rating</span> based on 2,500+ verified reviews
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
