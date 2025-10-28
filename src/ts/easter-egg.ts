/**
 * Easter egg - ASCII art for curious developers
 * @internal
 */
export function egg(): void {
  const art = `
                          ████████                          
                      ████░░░░░░░░████                      
                    ██░░░░░░░░░░░░░░░░██                    
                  ██░░░░░░░░░░░░░░░░░░░░██                  
                ██░░░░░░░░░░░░░░░░░░░░░░░░██                
              ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░██              
            ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██            
            ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██            
          ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██          
          ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██          
        ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██        
        ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██        
        ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██        
        ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██        
        ██░░░░░░░░░░░░░░░░░░  FFT  ░░░░░░░░░░░░░░░██        
        ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██        
        ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██        
        ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██        
        ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██        
          ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██          
          ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██          
            ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██            
            ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██            
              ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░██              
                ██░░░░░░░░░░░░░░░░░░░░░░░░██                
                  ██░░░░░░░░░░░░░░░░░░░░██                  
                    ██░░░░░░░░░░░░░░░░██                    
                      ████░░░░░░░░████                      
                          ████████                          

    dspx - Digital Signal Processing for TypeScript
    You found the Easter egg!

    Fun fact: This egg contains an FFT (Fast Fourier Transform)
    Just like how FFT reveals hidden frequencies in signals,
    you revealed this hidden message in the code.
    
    Thanks for being curious! 🔍
    
    - Built with 🎵 for signal processing nerds
    - 381 commits in a year
    - Powered by C++17 + SIMD magic ✨
  `;

  console.log(art);
}

export function credits() {
  console.log(`
    🎬 DSPX CREDITS 🎬
    
    Director:           Alan Kochukalam George
    Lead Developer:     Alan Kochukalam George
    C++ Architect:      Alan Kochukalam George
    SIMD Wizard:        Alan Kochukalam George
    Bug Hunter:         Alan Kochukalam George
    Coffee Consumer:    Also Alan
    
    Special Thanks:
    - Myovine for the production crisis that inspired this
    - GitHub Actions for the 3000+ CI minutes
    - StackOverflow for always having the answer
    - Whoever invented circular buffers
    
    No AIs were harmed in the making of this library.
    (Many were consulted though.)
    `);
}
