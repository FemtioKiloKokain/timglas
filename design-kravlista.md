Vi bygger en webbapp för en board game timer (tänk schackklocka) som ska användas under en turnering i Settlers of Catan. 

När en spelare öppnar appen i webbläsaren ska man kunna ange ett användarnamn som hänger med även om man öppnar och stänger fliken/appen/browsern. Bör således använda local storage eller liknande.

Vi kommer spela på fyra bord samtidigt, så i appen ska det finnas fyra rum tillgängliga med plats för fyra spelare. En spelare kan ansluta till ett av rumen och se de andra spelarna i rummet.

Innan matchen startar har alla spelare möjligheten att ändra ordningen på spelarna i rummet, eftersom att turordning baseras på tärningskast och behöver således kunna justeras innan matchen börjar.

Alla spelare i rummet måste markera sig som "Redo", först då börjar klockan ticka.

Under spelets gång bör appen visa en stor knapp som avser själv schackklockan. När man trycker på denna ska turen skickas över till nästa spelare.

En spelare ska från start av nytt spel ha en bank om 10 min, men för varje tur ska man också tillfälligt få 20 extra sekunder att använda för den turen.

Under spelet ska det också finnas en knapp för att avsluta spelet, vilken ska användas när någon har vunnit. En dialogruta ber om bekräftelse. Efter avslutat spel har man möjlighet att rapportera resultatet genom att lista rummets spelare i ordningen 1->4.

Appens förstasida bör visa de tillgängliga rummen samt en poängsammanställning. Du får gärna ge förslag på hur poängsättning borde fungera, ska det vara så enkelt som 4-3-2-1 poäng eller finns det en bättre modell.

Appen bör använda en url-paramater för att ange vilken tävling det rör. En tävling kan alltså ha 16 unika spelare med fyra rum, och varje tävling har separata poängställningar.

- webapp
- schackklocka
- hantera 16 spelare fördelat över 4 rum/bord med fyra spelare i varje