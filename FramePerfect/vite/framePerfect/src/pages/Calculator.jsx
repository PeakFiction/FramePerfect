// Calculator.jsx
import React, { useState } from "react";

export default function Calculator() {
  const [expression, setExpression] = useState("");
  const [isCounterHit, setIsCounterHit] = useState(false);

  const appendNumber = (n) => {
    setExpression((prev) => prev + String(n));
  };

  const appendOperator = (op) => {
    setExpression((prev) => prev + op);
  };

  const toggleCounterHit = () => {
    setIsCounterHit((prev) => !prev);
  };

  const clearAll = () => {
    setExpression("");
    setIsCounterHit(false);
  };

  const calculateResult = () => {
    const hits = expression.split("+").map(Number).filter((v) => !Number.isNaN(v));
    let totalDamage = 0;

    hits.forEach((hit, index) => {
      let damageMultiplier;
      if (isCounterHit) {
        if (index === 0) damageMultiplier = 1.2;
        else if (index === 1) damageMultiplier = 0.7;
        else if (index === 2) damageMultiplier = 0.5;
        else damageMultiplier = 0.3;
      } else {
        if (index === 0) damageMultiplier = 1.0;
        else if (index === 1) damageMultiplier = 0.7;
        else if (index === 2) damageMultiplier = 0.5;
        else damageMultiplier = 0.3;
      }
      totalDamage += hit * damageMultiplier;
    });

    setExpression(totalDamage.toFixed(2));
  };

  const styles = {
    page: {
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      backgroundColor: "#000",
      minHeight: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      margin: 0,
      color: "#fff",
    },
    calculator: {
      width: 300,
      backgroundColor: "#1a1a1a",
      borderRadius: 10,
      boxShadow: "0 0 20px rgba(255, 255, 255, 0.1)",
      padding: 20,
      textAlign: "center",
    },
    display: { marginBottom: 20 },
    input: {
      width: "100%",
      padding: 10,
      fontSize: 24,
      textAlign: "right",
      border: "1px solid #333",
      borderRadius: 5,
      backgroundColor: "#333",
      color: "#fff",
    },
    buttons: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 10,
    },
    button: {
      padding: 15,
      fontSize: 18,
      backgroundColor: isCounterHit ? "#8b0000" : "#2b2b2b",
      border: "none",
      borderRadius: 5,
      color: "#fff",
      cursor: "pointer",
      transition: "background-color 0.3s ease",
    },
    status: { marginTop: 20, fontWeight: "bold" },
  };

  return (
    <div style={styles.page}>
      <div style={styles.calculator}>
        <h1>Tekken 8 Air Combo Damage Calculator</h1>

        <div style={styles.display}>
          <input style={styles.input} type="text" value={expression} readOnly />
        </div>

        <div style={styles.buttons}>
          <button style={styles.button} onClick={() => appendNumber(1)}>1</button>
          <button style={styles.button} onClick={() => appendNumber(2)}>2</button>
          <button style={styles.button} onClick={() => appendNumber(3)}>3</button>
          <button style={styles.button} onClick={() => appendOperator("+")}>+</button>

          <button style={styles.button} onClick={() => appendNumber(4)}>4</button>
          <button style={styles.button} onClick={() => appendNumber(5)}>5</button>
          <button style={styles.button} onClick={() => appendNumber(6)}>6</button>
          <button style={styles.button} onClick={clearAll}>Clear All</button>

          <button style={styles.button} onClick={() => appendNumber(7)}>7</button>
          <button style={styles.button} onClick={() => appendNumber(8)}>8</button>
          <button style={styles.button} onClick={() => appendNumber(9)}>9</button>
          <button style={styles.button} onClick={toggleCounterHit}>Toggle Counter Hit</button>

          <button style={styles.button} onClick={() => appendNumber(0)}>0</button>
          <button style={styles.button} onClick={calculateResult}>=</button>
        </div>

        <p style={styles.status}>{isCounterHit ? "Counter Hit Mode" : "Normal Hit Mode"}</p>
      </div>
    </div>
  );
}
