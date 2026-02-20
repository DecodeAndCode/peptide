https://www.peptidego.dev/

# PeptideGo 🧬
**AI Search Agent for Peptide Brand Reputation Monitoring**

> *2nd Place Winner at Pulse NYC Hackathon Vol. 3*

---

## 🎯 Problem Statement

As search evolves from traditional blue links to AI-generated answers (SearchGPT, Perplexity), peptide brands face a critical challenge: **they have no visibility into what AI models are actually saying about their products**.

Traditional SEO tools track keyword rankings in Google. But what happens when ChatGPT thinks your peptide is only for hair loss when you also offer skin and acne solutions? **What happens when an LLM hallucinates claims about your brand?**

PeptideGo solves this by providing:
- **Real-time AI model analysis** of your brand representation
- **Gap detection** across peptide categories (hair, skin, acne)
- **Actionable recommendations** to improve visibility and accuracy in LLM outputs

---

## 💡 The Solution: PeptideGo

An **AI-powered agentic workflow** that monitors and optimizes your brand's presence in AI-generated search results.

### How It Works

1. **Ground Truth Collection**
   - Scrapes and analyzes your official brand website
   - Identifies key claims, products, and differentiators
   - Generates semantic embeddings for comparison

2. **LLM Probing**
   - Submits curated user-persona queries to SearchGPT, Perplexity, and other LLM engines
   - Captures model responses across peptide categories (hair, skin, acne, muscle)
   - Example queries: *"Best peptide for skin health?"*, *"How do peptides help with acne?"*

3. **Gap Analysis**
   - Compares LLM outputs against ground truth using **cosine similarity** embeddings
   - Identifies hallucinations, missing information, and inaccuracies
   - Highlights content opportunities

4. **GEO Strategy Recommendations**
   - Programmatically generates **"Generative Engine Optimization" (GEO)** strategies
   - Suggests specific content additions to fix identified gaps
   - Prioritizes by impact and relevance

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
✅ **Domain-specific** for peptide industry (but extensible to other verticals)  
✅ **Real-time LLM probing** across SearchGPT, Perplexity, ChatGPT  
✅ **Actionable recommendations** ranked by impact  
✅ **Built in 6 hours** for hackathon constraints  

---

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
- Domain-specific insights for peptide market
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
