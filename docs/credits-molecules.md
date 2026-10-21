# Credits: molecules from the Protein Data Bank

Built by `tools/build_molecules.mjs` from each entry's first biological assembly, downloaded from the RCSB
Protein Data Bank (https://www.rcsb.org; Berman et al. (2000) *Nucleic Acids Res.* 28:235). PDB data is
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/); we cite each structure's paper as the PDB asks.
Each is drawn as beads: every heavy atom at its van der Waals radius, or one bead per amino acid or nucleotide.
The flu virus places copies of the two spike proteins on a membrane modelled in code; its other parts, and the
giant virus and the bacterium, are modelled in code in `js/micro.js`.

- **dna**: [PDB 1BNA](https://www.rcsb.org/structure/1BNA), STRUCTURE OF A B-DNA DODECAMER. CONFORMATION AND DYNAMICS. The Dickerson dodecamer: twelve base pairs of B-DNA, the first DNA structure solved to atomic detail. 486 beads (atoms). Paper: Drew, H.R. et al. (1981). Structure of a B-DNA dodecamer: conformation and dynamics. *Proc.Natl.Acad.Sci.USA*. doi:10.1073/pnas.78.4.2179. Fetched 2026-10-21.
- **ha**: [PDB 3HMG](https://www.rcsb.org/structure/3HMG), REFINEMENT OF THE INFLUENZA VIRUS HEMAGGLUTININ BY SIMULATED ANNEALING. Influenza haemagglutinin (H3), the spike that binds a cell and fuses with it. 1,527 beads (residues). Paper: Weis, W.I. et al. (1990). Refinement of the influenza virus hemagglutinin by simulated annealing. *J.Mol.Biol.*. doi:10.1016/0022-2836(90)90234-D. Fetched 2026-10-21.
- **haemoglobin**: [PDB 2HHB](https://www.rcsb.org/structure/2HHB), THE CRYSTAL STRUCTURE OF HUMAN DEOXYHAEMOGLOBIN AT 1.74 ANGSTROMS RESOLUTION. Human deoxyhaemoglobin: two alpha and two beta chains, each holding a haem. 4,558 beads (atoms). Paper: Fermi, G. et al. (1984). The crystal structure of human deoxyhaemoglobin at 1.74 A resolution *J.Mol.Biol.*. doi:10.1016/0022-2836(84)90472-8. Fetched 2026-10-21.
- **na**: [PDB 2HTY](https://www.rcsb.org/structure/2HTY), N1 neuraminidase. Influenza neuraminidase (N1, from H5N1), the enzyme that cuts new viruses free. 1,548 beads (residues). Paper: Russell, R.J. et al. (2006). The structure of H5N1 avian influenza neuraminidase suggests new opportunities for drug design. *Nature*. doi:10.1038/nature05114. Fetched 2026-10-21.
- **ribosome**: [PDB 7K00](https://www.rcsb.org/structure/7K00), Structure of the Bacterial Ribosome at 2 Angstrom Resolution. The E. coli ribosome, its two subunits of RNA and protein, which reads mRNA to build proteins. 10,471 beads (residues). Paper: Watson, Z.L. et al. (2020). Structure of the bacterial ribosome at 2 angstrom resolution. *Elife*. doi:10.7554/eLife.60482. Fetched 2026-10-21.
