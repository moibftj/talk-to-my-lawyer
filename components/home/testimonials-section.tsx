import { Star, Quote } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const testimonials = [
  {
    name: "Sarah M.",
    role: "Small Business Owner",
    quote: "I was owed $15,000 from a client who refused to pay. Within a week of sending the demand letter, they agreed to a payment plan. Worth every penny.",
    rating: 5,
  },
  {
    name: "James T.",
    role: "Freelance Contractor",
    quote: "The cease and desist letter stopped my former employer from violating my non-compete. Professional, fast, and far cheaper than hiring a lawyer directly.",
    rating: 5,
  },
  {
    name: "Maria L.",
    role: "Property Manager",
    quote: "I've used Talk-to-my-Lawyer for multiple tenant disputes. The membership pays for itself after just one letter. The attorneys are thorough and responsive.",
    rating: 5,
  },
]

export default function TestimonialsSection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-linear-to-br from-slate-50 via-sky-50/40 to-blue-50/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <Badge className="bg-sky-100 text-[#199df4] mb-4">
            Trusted by thousands
          </Badge>
          <h2 className="text-4xl font-bold mb-4">What Our Clients Say</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Real results from real clients who resolved their disputes with our attorney-drafted letters.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.name}
              className="reveal-on-scroll"
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <Card className="h-full glass-card card-hover-lift group">
                <CardContent className="pt-6">
                  <div className="relative">
                    <Quote className="absolute -top-2 -left-1 h-8 w-8 text-sky-200 opacity-60" />
                    <div className="flex gap-1 mb-4 ml-8">
                      {Array.from({ length: testimonial.rating }).map((_, i) => (
                        <Star
                          key={i}
                          className="h-5 w-5 fill-yellow-400 text-yellow-400"
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-gray-600 leading-relaxed italic mb-6">
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>
                  <div className="border-t pt-4">
                    <p className="font-bold text-gray-900">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
