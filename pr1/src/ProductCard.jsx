import { useState } from "react";

function ProductCard(props){
    const [count,setCount]=useState(0);

    return(
        <div>
            <img src={props.image} width={"150"} height={"150"}/>
            <h2>{props.name}</h2>
            <p>Цена:{props.props} руб</p>
            <p>В корзине:{count}</p>
            <button onClick={()=> setCount(count+1)}>Добавить в корзину</button>
            
        </div>
    )

}

export default ProductCard;