https://www.peptidego.dev/

# SuppGo 🧬
**AI Search Agent for Supplement Brand Visibility + Product Truth Monitoring**

> *2nd Place Winner at Pulse NYC Hackathon Vol. 3*

---

## 🌍 Vision

**SuppGo’s vision is to become the infrastructure that determines which brands get recommended by AI when people ask what to buy for their health.**

As AI replaces traditional search and increasingly guides consumer decisions, SuppGo ensures companies are accurately understood, trusted, and recommended by generative systems.

In simple terms:

👉 **We help brands win in the AI-driven discovery economy.**

---

## 🧠 Core Thesis

**Generative AI is becoming the primary decision layer for product discovery, and brands that are not optimized for AI interpretation will lose visibility, trust, and revenue.**

Historically:
- SEO determined who ranked in search.

Now:
- AI reasoning determines who gets recommended.

Brands cannot directly control AI outputs, but they *can* control the signals AI uses to evaluate them.

**SuppGo exists to measure, diagnose, and optimize those signals.**

---

## 🎯 Problem Statement

As search evolves from traditional blue links to AI-generated answers (ChatGPT-style search, Perplexity-style experiences, AI summaries), supplement brands face a critical challenge:

**they have no visibility into what AI models are actually saying about their products — or whether it’s accurate.**

Traditional SEO tools track keyword rankings in Google. But what happens when:
- an AI claims your supplement is “unsafe” due to bad sourcing assumptions,
- it confuses your product category or intended use,
- it attributes a competitor’s differentiators to you (or vice versa),
- or it hallucinates claims about your ingredients, dosing, or compliance?

**This is a brand visibility + product truth problem.**

SuppGo solves this by providing:
- **AI model analysis** of your brand representation
- **Gap detection** across supplement use-cases (sleep, stress, gut, cognition, performance, skin, recovery, etc.)
- **Actionable AEO/GEO recommendations** to improve visibility and accuracy in AI outputs

---

## 💡 The Solution: SuppGo

An **AI-powered agentic workflow** that monitors and optimizes your brand's presence in AI-generated search and recommendation experiences.

### How It Works

1. **Ground Truth Collection**
   - Scrapes and analyzes your official brand website
   - Identifies key claims, products, positioning, and differentiators
   - Generates semantic embeddings for comparison

2. **LLM Probing**
   - Submits curated user-intent queries to multiple LLM/search engines
   - Captures responses across supplement use-cases
   - Example queries:
     - *"What’s the best supplement for sleep and why?"*
     - *"Is [Brand] third-party tested?"*
     - *"Is [Ingredient] safe and effective?"*

3. **Gap Analysis (Visibility + Truth)**
   - Compares AI outputs against your ground truth using **cosine similarity** embeddings
   - Flags:
     - missing coverage (you’re not mentioned where you should be)
     - misrepresentation (wrong positioning, wrong product category)
     - hallucinations (unsupported claims)
     - citation weaknesses (low-quality or irrelevant sources being used)

4. **AEO/GEO Strategy Recommendations**
   - Programmatically generates **AEO/GEO** (“Answer/Generative Engine Optimization”) strategies
   - Suggests specific content additions and signal improvements to fix gaps
   - Prioritizes by expected impact and relevance

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| **Agentic Framework** | LangChain |
| **Language** | Python 3.9+ |
| **LLM Integration** | OpenAI API, Anthropic Claude |
| **Embeddings** | OpenAI Embeddings / Sentence Transformers |
| **Vector Similarity** | Scikit-learn (Cosine Similarity) |
| **Web Scraping** | BeautifulSoup4, Requests |
| **Data Processing** | Pandas, NumPy |

---

## 📊 Key Features

✅ **Multi-step agentic workflow** using LangChain  
✅ **Semantic gap analysis** via embeddings and cosine similarity  
✅ **Domain-specific** for supplements (extensible to other regulated consumer health verticals)  
✅ **Real-time LLM probing** across AI search experiences  
✅ **Actionable recommendations** ranked by impact  
✅ **Built in 6 hours** for hackathon constraints  

---

## 🚀 Quick Start

### Prerequisites
```bash
python >= 3.9
pip

## 🚀 Quick Start

### Prerequisites
```bash
python >= 3.9
pip
```

### Installation
```bash
git clone https://github.com/DecodeAndCode/PeptideGo.git
cd PeptideGo
pip install -r requirements.txt
```

### Environment Setup
Create a `.env` file with your API keys:
```
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
```

---

## 📈 Results

**Built in 6 hours during Pulse NYC Hackathon Vol. 3**

Achieved:
- End-to-end MVP from input URL → strategic action items
- Multi-step agentic workflow with LangChain
- Semantic gap detection via embeddings
- Domain-specific insights for supplement market
- Novel "GEO" framework for AI search optimization

---

## 🎓 Learning Outcomes

This project demonstrates:
- **Agentic AI design**: Multi-step workflows with LangChain
- **RAG principles**: Retrieval-augmented gap analysis
- **Semantic search**: Embeddings and cosine similarity for comparison
- **Rapid prototyping**: Hackathon-quality MVP in 6 hours
- **Product thinking**: Identifying real market gaps and building solutions

---

## 🔮 Future Enhancements

- [ ] Dashboard UI for brand monitoring
- [ ] Real-time tracking of LLM representation changes
- [ ] Batch analysis for multiple brands
- [ ] Integration with more LLM engines (Gemini, Llama, etc.)
- [ ] Automated content generation based on GEO recommendations
- [ ] Competitor analysis (compare your brand vs competitors in LLM outputs)
- [ ] Historical trend tracking

---

## 📚 Resources

- [LangChain Documentation](https://python.langchain.com/)
- [OpenAI Embeddings API](https://platform.openai.com/docs/guides/embeddings)
- [SearchGPT Overview](https://openai.com/searchgpt)
- [Perplexity AI](https://www.perplexity.ai/)

---

## 💬 Feedback

Have questions? Found a bug? Open an issue or reach out!

**Built with 🧬 at Pulse NYC Hackathon**
