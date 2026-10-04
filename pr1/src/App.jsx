import './App.css'
import { useState } from 'react';
import ProductCard from './ProductCard';

function App() {
  return(
    <div>
      <ProductCard name="Наушники" price="550" image="https://images.biggeek.ru/1/870/e42d/28401-970airpods-4-hero-select-202409@2x.jpg"/>
      <ProductCard name="Kappa" price="15000" image="https://avatars.mds.yandex.net/get-mpic/16435911/2a0000019a4691b4935177a0088906cb2f77/450x600"/>
      <ProductCard name="lada" price="10000" image="https://avatars.avto.ru/get-autoru-vos/20543926/069f4f298569575dfa746373e0e9bade/1200x900"/>
      
    </div>


    
  );
}

export default App
