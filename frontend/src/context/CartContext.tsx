import React, {
  createContext,
  useContext,
  useEffect,
  useState
} from "react";

import { getToken } from "../utils/auth";

const BASE_URL = import.meta.env.VITE_API_URL ?? "";

interface Shop {
  _id: string;
  name: string;
  address?: string;
}

interface CartItem {
  price: {
    _id: string;
    name: string;
    charge: number;
    picture?: string;
    icon?: string;
  };

  shop: Shop;

  quantity: number;
}

interface CartContextType {
  cart: CartItem[];
  totalItems: number;
  loading: boolean;

  fetchCart: () => Promise<void>;

  addToCart: (
    priceId: string,
    shopId: string,
    quantity?: number
  ) => Promise<void>;

  updateCart: (
    priceId: string,
    shopId: string,
    quantity: number
  ) => Promise<void>;

  removeFromCart: (
    priceId: string,
    shopId: string
  ) => Promise<void>;

  getQuantity: (
    priceId: string,
    shopId: string
  ) => number;
}

const CartContext = createContext<CartContextType | null>(null);

export const useCart = () => {

  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }

  return context;

};

export default function CartProvider({
  children
}: {
  children: React.ReactNode;
}) {

  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  const token = getToken();

  // =====================================
  // FETCH CART
  // =====================================
  const fetchCart = async () => {

    try {

      setLoading(true);

      const res = await fetch(
        `${BASE_URL}/api/cart`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await res.json();

      setCart(
        (data?.data?.service || []).filter(
          (item: CartItem) =>
            item?.price?._id &&
            item?.shop?._id
        )
      );

    }
    catch (err) {

      console.error(err);

    }
    finally {

      setLoading(false);

    }

  };



  // =====================================
  // ADD TO CART
  // =====================================
  const addToCart = async (
    priceId: string,
    shopId: string,
    quantity = 1
  ) => {

    try {

      await fetch(
        `${BASE_URL}/api/cart/add`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            priceId,
            shopId,
            quantity
          })
        }
      );

      await fetchCart();

    }
    catch (err) {

      console.error(err);

    }

  };



  // =====================================
  // UPDATE CART
  // =====================================
  const updateCart = async (
    priceId: string,
    shopId: string,
    quantity: number
  ) => {

    try {

      if (quantity <= 0) {

        await removeFromCart(
          priceId,
          shopId
        );

        return;

      }

      await fetch(
        `${BASE_URL}/api/cart/edit`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            priceId,
            shopId,
            quantity
          })
        }
      );

      await fetchCart();

    }
    catch (err) {

      console.error(err);

    }

  };



  // =====================================
  // REMOVE FROM CART
  // =====================================
  const removeFromCart = async (
    priceId: string,
    shopId: string
  ) => {

    try {

      await fetch(
        `${BASE_URL}/api/cart/delete`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            priceId,
            shopId
          })
        }
      );

      await fetchCart();

    }
    catch (err) {

      console.error(err);

    }

  };



  // =====================================
  // GET QUANTITY
  // =====================================
  const getQuantity = (
    priceId: string,
    shopId: string
  ) => {

    const item = cart.find(
      item =>
        item?.price?._id === priceId &&
        item?.shop?._id === shopId
    );

    return item?.quantity || 0;

  };



  useEffect(() => {

    fetchCart();

  }, []);



  const totalItems = cart.reduce(
    (acc, item) => acc + item.quantity,
    0
  );



  return (
    <CartContext.Provider
      value={{
        cart,
        totalItems,
        loading,
        fetchCart,
        addToCart,
        updateCart,
        removeFromCart,
        getQuantity
      }}
    >
      {children}
    </CartContext.Provider>
  );

}