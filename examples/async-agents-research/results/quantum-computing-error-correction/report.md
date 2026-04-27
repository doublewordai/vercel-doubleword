# Quantum Computing Error Correction: A Comprehensive Research Report

## Executive Summary

Quantum error correction (QEC) has reached a critical inflection point in 2024-2025, with multiple research teams demonstrating logical qubits that outperform their underlying physical qubits—a fundamental requirement for fault-tolerant quantum computing. This report synthesizes findings across six key research areas: error correction codes and architectures, fault tolerance theory, topological approaches, hardware implementations, noise challenges, and recent breakthroughs.

**Key Findings:**

1. **Google Quantum AI** achieved the first demonstration of quantum error correction below the surface code threshold using superconducting qubits, proving that increasing physical qubit count exponentially suppresses logical error rates when physical operations are below the critical noise threshold [Nature](https://www.nature.com/articles/s41586-024-08449-y), [arXiv:2408.13687](https://arxiv.org/abs/2408.13687).

2. **Microsoft and Quantinuum** demonstrated the most reliable logical qubits on record using trapped-ion hardware, achieving error rates 800 times better than physical qubits and running over 14,000 experiments without a single error [Microsoft Blog](https://blogs.microsoft.com/blog/2024/04/03/advancing-science-microsoft-and-quantinuum-demonstrate-the-most-reliable-logical-qubits-on-record-with-an-error-rate-800x-better-than-physical-qubits/).

3. **IBM** announced a clear roadmap to fault-tolerant quantum computing by 2029, targeting 200 logical qubits capable of running 100 million quantum gates using bivariate bicycle codes rather than traditional surface codes [IBM Quantum Blog](https://www.ibm.com/quantum/blog/large-scale-ftqc).

4. Two distinct hardware platforms—superconducting qubits and trapped ions—have both achieved critical QEC milestones but employ fundamentally different architectural approaches suited to their respective physical constraints.

---

## 1. Fundamentals of Quantum Error Correction

### 1.1 The Challenge of Quantum Decoherence

Quantum information is extraordinarily fragile. State-of-the-art quantum processors have only recently demonstrated entangling gates with 99.9% fidelity, far short of the <10⁻¹⁰ error rates needed for practical applications in quantum chemistry, simulation, cryptography, and optimization [Nature](https://www.nature.com/articles/s41586-024-08449-y). Unlike classical bits, quantum states cannot be copied (due to the no-cloning theorem), making traditional redundancy-based error correction impossible.

Quantum decoherence—the loss of quantum coherence through interaction with the environment—manifests through several mechanisms:
- **T1 relaxation**: Energy decay from excited to ground state
- **T2 dephasing**: Loss of phase information without energy change
- **Gate errors**: Imperfections in quantum operations
- **Measurement errors**: Inaccuracies in reading out qubit states

### 1.2 The Threshold Theorem

The **quantum threshold theorem** (or quantum fault-tolerance theorem) provides the theoretical foundation for QEC. It states that a quantum computer with a physical error rate below a certain threshold can, through application of quantum error correction schemes, suppress the logical error rate to arbitrarily low levels [Wikipedia: Threshold theorem](https://en.wikipedia.org/wiki/Threshold_theorem).

Formally, for a quantum circuit on *n* qubits containing *p(n)* gates, the computation can be simulated with error probability at most *ε* using O(log^c(p(n)/ε)p(n)) gates, provided the physical error rate *p* is below some constant threshold. This result was proven independently by multiple research groups in the mid-1990s, building on Peter Shor's earlier work.

The threshold theorem resolves the critical question of whether quantum computers could perform long computations without succumbing to noise. Surprisingly, it shows that if gate errors are below a small enough constant, arbitrarily long quantum computations can be performed to arbitrarily good precision with only modest overhead.

### 1.3 Stabilizer Codes and the Surface Code

**Stabilizer codes** form the mathematical framework for most practical QEC schemes. These codes use the Pauli group structure to define a subspace (the code space) stabilized by a set of commuting operators [Wikipedia: Stabilizer code](https://en.wikipedia.org/wiki/Stabilizer_code). Key examples include:

- **Classical repetition code**: The simplest error correction scheme
- **Five-qubit code**: The smallest possible quantum error-correcting code
- **Surface code**: Currently the most promising approach for large-scale implementation

The **surface code** has emerged as the leading QEC architecture for superconducting qubit systems due to its favorable properties [Wikipedia: Surface code](https://en.wikipedia.org/wiki/Surface_code):

- **Local connectivity**: Only requires nearest-neighbor interactions on a 2D lattice
- **High threshold**: Approximately 1% error rate threshold, achievable with current technology
- **Scalability**: Can be extended to arbitrary code distances

For surface codes, the logical error rate follows the relation:

$$\varepsilon_d \propto \left(\frac{p}{p_{\text{thr}}}\right)^{(d+1)/2}$$

where *d* is the code distance (requiring 2d²−1 physical qubits per logical qubit), *p* is the physical error rate, and *p_thr* is the threshold error rate. When *p* ≪ *p_thr*, logical error rates are suppressed exponentially with code distance, with suppression factor Λ = ε_d/ε_{d+2} ≈ p_thr/p.

---

## 2. Hardware Implementation Approaches

### 2.1 Superconducting Qubits: Google's Breakthrough

**Google Quantum AI** achieved a landmark milestone in August 2024 (published in Nature, February 2025), demonstrating quantum error correction **below the surface code threshold** for the first time [Nature](https://www.nature.com/articles/s41586-024-08449-y), [arXiv:2408.13687](https://arxiv.org/abs/2408.13687).

**Technical Achievement:**
- Demonstrated that increasing the number of physical qubits in a surface code actually reduces logical error rates
- Validated the exponential suppression relationship predicted by theory
- Proved that when physical operations are below the critical noise threshold, logical error rates decrease exponentially as physical qubits per logical qubit increase

**Hardware Architecture Challenges:**
Superconducting systems face unique constraints:
1. **Planar layout limitations**: Single-chip architectures have space and control hardware constraints limiting qubit counts
2. **Routing serialization**: Planar routing leads to serialization of commuting gates
3. **Classical decoding strain**: Large ancilla patches create decoder bottlenecks

**Innovative Solutions:**
- **QuIRC (Quantum Interface Routing Card)**: A multi-chip architecture for lattice surgery between surface code modules within a single dilution refrigerator, reducing ancilla patch size by up to 77.8% and layer transpilation size by 51.9% [arXiv:2312.01246](https://arxiv.org/html/2312.01246v1)
- **IQM Constellation**: A new processor architecture specifically designed for scalable error correction in superconducting systems [IQM Blog](https://meetiqm.com/blog/iqm-constellation-a-new-quantum-processor-architecture-for-scalable-error-correction/)
- **Dynamic surface codes**: Google is exploring flexible surface code variants that open new avenues for QEC implementation [Google Research Blog](https://research.google/blog/dynamic-surface-codes-open-new-avenues-for-quantum-error-correction/)

### 2.2 Trapped Ion Systems: Microsoft-Quantinuum Collaboration

**Microsoft and Quantinuum** achieved what they called "the most reliable logical qubits on record" in April 2024, using Quantinuum's H-series trapped-ion hardware combined with Microsoft's qubit-virtualization system [Microsoft Blog](https://blogs.microsoft.com/blog/2024/04/03/advancing-science-microsoft-and-quantinuum-demonstrate-the-most-reliable-logical-qubits-on-record-with-an-error-rate-800x-better-than-physical-qubits/).

**Remarkable Results:**
- Ran more than **14,000 individual experiments without a single error**
- Demonstrated logical error rates **800 times better** than physical qubit error rates
- Entangled logical qubits encoded in the [[7,1,3]] Steane code with error rates 9.8 to 500 times lower than physical level
- Moved from NISQ (Noisy Intermediate-Scale Quantum) to **Level 2 Resilient quantum computing**

**Follow-up Achievement (September 2024):**
Microsoft and Quantinuum created **12 logical qubits** and demonstrated a hybrid, end-to-end chemistry simulation, showing practical applications of error-corrected logical qubits [Azure Quantum Blog](https://azure.microsoft.com/en-us/blog/quantum/2024/09/10/microsoft-and-quantinuum-create-12-logical-qubits-and-demonstrate-a-hybrid-end-to-end-chemistry-simulation/).

**Hardware Platform Advantages:**
Trapped ions offer distinct benefits for QEC:
1. **All-to-all connectivity**: Unlike superconducting qubits' nearest-neighbor constraints, trapped ions achieve full connectivity through ion shuttling
2. **High-fidelity gates**: State-of-the-art systems demonstrate >99.9% fidelity on both single- and two-qubit gates
3. **Long coherence times**: Ion qubits maintain quantum states for extended periods
4. **Identical qubits**: All ions of the same species are naturally identical, reducing calibration overhead

**QCCD Architecture:**
The **Quantum Charge-Coupled Device (QCCD)** architecture is the leading approach for scaling trapped ion systems. Recent research (October 2025) revealed a surprising finding: small traps holding only **2 ions** are optimal from both performance and hardware-efficiency standpoints—contrary to prior intuition favoring 20-30 ion traps. A topology-aware compilation method outperformed existing QCCD compilers by 3.8X in logical clock speed [arXiv:2510.23519](https://arxiv.org/html/2510.23519v1).

### 2.3 IBM's Alternative Approach: Bivariate Bicycle Codes

**IBM** announced in June 2025 a clear path to fault-tolerant quantum computing, diverging from the surface code approach [IBM Quantum Blog](https://www.ibm.com/quantum/blog/large-scale-ftqc):

- **Target**: IBM Quantum Starling by 2029—capable of running 100 million quantum gates on 200 logical qubits
- **Code choice**: Using **bivariate bicycle codes** (introduced in their 2024 Nature publication) rather than traditional surface codes
- **Decoder innovation**: Released the first accurate, fast, compact error correction decoder amenable to FPGA/ASIC implementation for real-time decoding
- **Claim**: IBM states it is the only organization capable of reaching hundreds of logical qubits and millions of gates by end of decade

This represents a significant strategic divergence from the surface code approach favored by Google and others, suggesting that different error correction codes may prove optimal for different hardware architectures.

---

## 3. Topological Quantum Error Correction

### 3.1 Majorana Fermions and Topological Qubits

Topological quantum computing offers a fundamentally different approach to error correction, encoding quantum information in non-local topological properties that are inherently protected from local perturbations.

**Majorana Zero Modes:**
Majorana fermions—particles that are their own antiparticles—can emerge as quasiparticle excitations in certain condensed matter systems. When localized as zero-energy modes in superconductor-semiconductor heterostructures, they exhibit non-Abelian statistics suitable for topological quantum computation [Nature: npj Quantum Information](https://www.nature.com/articles/npjqi20151).

**Microsoft's Majorana 1 Processor (February 2025):**
Microsoft unveiled **Majorana 1**, described as "the world's first quantum processor powered by topological qubits" [Microsoft Azure Blog](https://azure.microsoft.com/en-us/blog/quantum/2025/02/19/microsoft-unveils-majorana-1-the-worlds-first-quantum-processor-powered-by-topological-qubits/). This represents a major milestone in the decades-long effort to realize topological quantum computing.

However, the field has faced significant controversy. Several high-profile papers claiming observation of Majorana signatures were retracted due to "insufficient scientific rigour," including a notable Nature paper retracted in 2021 [Retraction Watch](https://retractionwatch.com/2021/03/08/authors-retract-nature-majorana-paper-apologize-for-insufficient-scientific-rigour/), [QuTech Timeline](https://qutech.nl/research-engineering/qubit-research/retracted-majorana-papers/). Despite these setbacks, Microsoft continues to pursue the topological approach.

### 3.2 Non-Abelian Anyons

**Quantinuum's Achievement (2024):**
Quantinuum demonstrated the first creation and manipulation of non-Abelian anyons—exotic quasiparticles that could enable topological quantum computation [Quantinuum Blog](https://www.quantinuum.com/blog/quantinuum-demonstrates-the-first-creation-and-manipulation-of-non-abelian-anyons). This work provides an alternative pathway to topological protection without requiring Majorana fermions.

### 3.3 Comparison with Conventional QEC

Topological approaches differ fundamentally from stabilizer-based QEC:

| Aspect | Stabilizer Codes (Surface Code) | Topological QEC |
|--------|--------------------------------|-----------------|
| Protection mechanism | Active error detection and correction | Passive protection from topology |
| Overhead | Requires many physical qubits per logical qubit | Potentially lower overhead |
| Maturity | Experimentally demonstrated (2024-2025) | Early experimental stage |
| Hardware requirements | Standard superconducting or ion trap systems | Exotic materials (superconductor-semiconductor hybrids) |

---

## 4. Challenges and Noise Mitigation

### 4.1 Physical Error Rate Requirements

Current state-of-the-art quantum processors achieve physical error rates around 10⁻³ to 10⁻⁴, but practical applications require error rates below 10⁻⁹. This gap necessitates sophisticated error correction with substantial qubit overhead.

### 4.2 Decoherence Mechanisms

Quantum decoherence arises from multiple sources [Wikipedia: Quantum decoherence](https://en.wikipedia.org/wiki/Quantum_decoherence):

- **Environmental coupling**: Interaction with thermal baths, electromagnetic fields
- **Two-level system defects**: Material imperfections causing energy relaxation
- **Control electronics noise**: Imperfections in pulse generation and timing
- **Cross-talk**: Unwanted interactions between neighboring qubits

Recent research (July 2025) identified individual defects in superconducting quantum circuits, enabling targeted mitigation strategies [phys.org](https://phys.org/news/2025-07-individual-defects-superconducting-quantum-circuits.html).

### 4.3 Dynamical Decoupling

**Dynamical decoupling** techniques use sequences of control pulses to average out environmental noise, extending coherence times [Wikipedia: Dynamical decoupling](https://en.wikipedia.org/wiki/Dynamical_decoupling). These methods complement active error correction by reducing the raw error rates that QEC must handle.

### 4.4 Real-Time Decoding Challenges

A critical bottleneck in QEC implementation is the classical processing required for real-time error syndrome decoding:

- Error syndromes must be measured and processed faster than errors accumulate
- Decoder latency directly impacts logical error rates
- IBM's recent decoder development addresses this challenge with FPGA/ASIC-compatible designs [IBM Quantum Blog](https://www.ibm.com/quantum/blog/large-scale-ftqc)

---

## 5. Recent Breakthroughs (2024-2025)

### 5.1 Timeline of Major Achievements

**April 2024:** Microsoft and Quantinuum demonstrate 800× improvement in logical error rates, running 14,000+ experiments without error [Microsoft Blog](https://blogs.microsoft.com/blog/2024/04/03/advancing-science-microsoft-and-quantinuum-demonstrate-the-most-reliable-logical-qubits-on-record-with-an-error-rate-800x-better-than-physical-qubits/).

**August 2024:** Google Quantum AI demonstrates quantum error correction below the surface code threshold, validating the fundamental scaling relationship [Nature](https://www.nature.com/articles/s41586-024-08449-y), [arXiv:2408.13687](https://arxiv.org/abs/2408.13687).

**September 2024:** Microsoft and Quantinuum create 12 logical qubits and demonstrate hybrid chemistry simulation [Azure Quantum Blog](https://azure.microsoft.com/en-us/blog/quantum/2024/09/10/microsoft-and-quantinuum-create-12-logical-qubits-and-demonstrate-a-hybrid-end-to-end-chemistry-simulation/).

**February 2025:** Microsoft unveils Majorana 1, the first topological quantum processor [Microsoft Azure Blog](https://azure.microsoft.com/en-us/blog/quantum/2025/02/19/microsoft-unveils-majorana-1-the-worlds-first-quantum-processor-powered-by-topological-qubits/).

**June 2025:** IBM announces detailed roadmap to 200 logical qubits by 2029 using bivariate bicycle codes [IBM Quantum Blog](https://www.ibm.com/quantum/blog/large-scale-ftqc).

### 5.2 Google's Willow Chip

Google introduced **Willow**, described as their "state-of-the-art quantum chip," achieving the error correction milestone [Google Blog](https://blog.google/innovation-and-ai/technology/research/google-willow-quantum-chip/). The achievement was characterized as "a truly remarkable breakthrough" by Nature [Nature News](https://www.nature.com/articles/d41586-024-04028-3).

---

## 6. Comparative Analysis of Approaches

### 6.1 Platform Comparison

| Aspect | Superconducting Qubits | Trapped Ions | Topological |
|--------|----------------------|--------------|-------------|
| **Primary QEC Code** | Surface code (Google); Bivariate bicycle (IBM) | [[7,1,3]] Steane code | Topological protection |
| **Connectivity** | Nearest-neighbor (planar) | All-to-all via ion shuttling | Braiding operations |
| **Best Logical Error Suppression** | Below surface code threshold (exponential) | 800× better than physical | Theoretical advantage |
| **Scaling Approach** | Multi-chip modules; 2D arrays | QCCD with ion transport | Nanowire networks |
| **Gate Fidelity** | ~99.9% | >99.9% | Not yet demonstrated |
| **Major Players** | Google, IBM, IQM | Quantinuum, IonQ, Oxford Ionics | Microsoft |
| **Fault-Tolerance Timeline** | IBM: 2029; Google: ongoing | "By end of decade" | Uncertain |

### 6.2 Code Choice Trade-offs

Different error correction codes offer distinct advantages:

- **Surface codes**: High threshold (~1%), local connectivity, well-understood, but high qubit overhead
- **Bivariate bicycle codes** (IBM): Lower overhead, suited to heavy-hexagonal lattices, but less experimentally validated
- **Steane [[7,1,3]] code**: Smaller code size, good for early demonstrations, but lower threshold
- **LDPC codes**: Very low overhead, but require long-range connectivity challenging for superconducting systems

---

## 7. Areas of Disagreement and Open Questions

### 7.1 Optimal Error Correction Code

There is no consensus on which error correction code will ultimately prove best:
- Google and many academic groups favor surface codes
- IBM advocates for bivariate bicycle codes
- Some researchers propose LDPC codes for specific architectures
- Topological approaches claim inherent protection but remain experimentally unproven at scale

### 7.2 Hardware Platform Superiority

The debate between superconducting qubits and trapped ions continues:
- **Superconducting advocates** emphasize faster gate speeds and manufacturing scalability
- **Ion trap proponents** highlight superior coherence times and all-to-all connectivity
- Both platforms have now demonstrated critical QEC milestones, suggesting both may succeed

### 7.3 Timeline Predictions

Organizations make varying claims about fault-tolerance timelines:
- IBM targets 2029 for 200 logical qubits
- Quantinuum suggests "by end of decade"
- Google's timeline remains less specific
- Independent experts often express more skepticism than company announcements

### 7.4 Topological Qubit Viability

The topological approach faces significant questions:
- Previous Majorana claims were retracted, raising credibility concerns
- Microsoft's Majorana 1 announcement requires independent verification
- The field remains divided on whether topological protection can be practically realized

---

## 8. Areas for Further Research

### 8.1 Technical Challenges Requiring Attention

1. **Physical error rate reduction**: Current ~10⁻³ to 10⁻⁴ rates must reach below 10⁻⁹ for practical applications
2. **Decoder development**: Real-time classical processing must keep pace with quantum operations
3. **Qubit overhead**: Millions of physical qubits may be required for useful computations; reducing this overhead is critical
4. **Interconnect technology**: Multi-chip architectures require reliable quantum interconnects
5. **Material science**: Better understanding of defect mechanisms in superconducting circuits

### 8.2 Promising Research Directions

1. **Hybrid architectures**: Combining strengths of different platforms (e.g., superconducting processors with ion trap memories)
2. **Machine learning for decoding**: Neural network-based decoders may outperform traditional algorithms
3. **Autonomous error correction**: Reducing classical control overhead through integrated quantum-classical systems
4. **Novel code families**: Continued exploration of LDPC codes, Floquet codes, and other alternatives
5. **Application-specific QEC**: Tailoring error correction to specific algorithmic requirements

---

## 9. Conclusion

Quantum error correction has transitioned from theoretical concept to experimental reality in 2024-2025. The demonstrations by Google, Microsoft-Quantinuum, and IBM validate the fundamental principles of fault-tolerant quantum computing and mark the beginning of the transition from NISQ-era devices to genuinely error-corrected quantum computers.

Key takeaways:

1. **Multiple pathways exist**: Both superconducting and trapped-ion platforms have demonstrated viable approaches to QEC, suggesting diversity in eventual successful architectures.

2. **The threshold has been crossed**: Google's demonstration of below-threshold surface code operation proves that exponential error suppression is achievable in practice, not just theory.

3. **Logical qubits are now superior to physical qubits**: The Microsoft-Quantinuum achievement of 800× improvement demonstrates that error correction can deliver on its promise.

4. **Roadmaps are concrete**: IBM's detailed 2029 target and similar commitments from other organizations provide tangible milestones for the field.

5. **Challenges remain substantial**: Despite progress, the gap between current capabilities and practical fault-tolerant quantum computing remains large, requiring continued advances in materials, control systems, and error correction theory.

The next five years will be critical in determining which approaches scale most effectively and whether the optimistic timelines prove achievable. The convergence of theoretical understanding, experimental capability, and engineering sophistication suggests that fault-tolerant quantum computing is no longer a question of "if" but "when" and "how."

---

## References

1. Acharya, R. et al. "Quantum error correction below the surface code threshold." *Nature* (2025). [https://www.nature.com/articles/s41586-024-08449-y](https://www.nature.com/articles/s41586-024-08449-y)

2. Acharya, R. et al. "Quantum error correction below the surface code threshold." arXiv:2408.13687 (2024). [https://arxiv.org/abs/2408.13687](https://arxiv.org/abs/2408.13687)

3. Microsoft. "Advancing science: Microsoft and Quantinuum demonstrate the most reliable logical qubits on record." Microsoft Blog (April 2024). [https://blogs.microsoft.com/blog/2024/04/03/advancing-science-microsoft-and-quantinuum-demonstrate-the-most-reliable-logical-qubits-on-record-with-an-error-rate-800x-better-than-physical-qubits/](https://blogs.microsoft.com/blog/2024/04/03/advancing-science-microsoft-and-quantinuum-demonstrate-the-most-reliable-logical-qubits-on-record-with-an-error-rate-800x-better-than-physical-qubits/)

4. Microsoft. "Microsoft and Quantinuum create 12 logical qubits and demonstrate a hybrid, end-to-end chemistry simulation." Azure Quantum Blog (September 2024). [https://azure.microsoft.com/en-us/blog/quantum/2024/09/10/microsoft-and-quantinuum-create-12-logical-qubits-and-demonstrate-a-hybrid-end-to-end-chemistry-simulation/](https://azure.microsoft.com/en-us/blog/quantum/2024/09/10/microsoft-and-quantinuum-create-12-logical-qubits-and-demonstrate-a-hybrid-end-to-end-chemistry-simulation/)

5. IBM. "IBM lays out clear path to fault-tolerant quantum computing." IBM Quantum Blog (June 2025). [https://www.ibm.com/quantum/blog/large-scale-ftqc](https://www.ibm.com/quantum/blog/large-scale-ftqc)

6. Wikipedia. "Surface code." [https://en.wikipedia.org/wiki/Surface_code](https://en.wikipedia.org/wiki/Surface_code)

7. Wikipedia. "Threshold theorem." [https://en.wikipedia.org/wiki/Threshold_theorem](https://en.wikipedia.org/wiki/Threshold_theorem)

8. Wikipedia. "Stabilizer code." [https://en.wikipedia.org/wiki/Stabilizer_code](https://en.wikipedia.org/wiki/Stabilizer_code)

9. Google Research. "Dynamic surface codes open new avenues for quantum error correction." [https://research.google/blog/dynamic-surface-codes-open-new-avenues-for-quantum-error-correction/](https://research.google/blog/dynamic-surface-codes-open-new-avenues-for-quantum-error-correction/)

10. IQM. "IQM Constellation: A New Quantum Processor Architecture for Scalable Error Correction." [https://meetiqm.com/blog/iqm-constellation-a-new-quantum-processor-architecture-for-scalable-error-correction/](https://meetiqm.com/blog/iqm-constellation-a-new-quantum-processor-architecture-for-scalable-error-correction/)

11. arXiv:2312.01246. "Co-Designed Superconducting Architecture for Lattice Surgery of Surface Codes with Quantum Interface Routing Card." [https://arxiv.org/html/2312.01246v1](https://arxiv.org/html/2312.01246v1)

12. arXiv:2510.23519. "Architecting Scalable Trapped Ion Quantum Computers using Surface Codes." [https://arxiv.org/html/2510.23519v1](https://arxiv.org/html/2510.23519v1)

13. arXiv:2404.02280. "Demonstration of logical qubits and repeated error correction with better-than-physical error rates." [https://arxiv.org/abs/2404.02280](https://arxiv.org/abs/2404.02280)

14. Google. "Meet Willow, our state-of-the-art quantum chip." [https://blog.google/innovation-and-ai/technology/research/google-willow-quantum-chip/](https://blog.google/innovation-and-ai/technology/research/google-willow-quantum-chip/)

15. Nature. "'A truly remarkable breakthrough': Google's new quantum chip achieves accuracy milestone." [https://www.nature.com/articles/d41586-024-04028-3](https://www.nature.com/articles/d41586-024-04028-3)