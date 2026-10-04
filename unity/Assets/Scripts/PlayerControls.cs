using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class PlayerControls : MonoBehaviour
{
    public Transform player;
    public Rigidbody2D rb2d;

    public float moveForce = 1100f;

    // Start is called before the first frame update
    void Start()
    {
        
    }

    // Update is called once per frame
    void FixedUpdate()
    {
        Vector3 pos = transform.position;

        //Movment
        if (Input.GetKey("w") || Input.GetKey(KeyCode.UpArrow))
        {
            rb2d.AddForce(Vector2.up * moveForce * Time.deltaTime, ForceMode2D.Impulse);
        }

        if (Input.GetKey("s") || Input.GetKey(KeyCode.DownArrow))
        {
            rb2d.AddForce(Vector2.down * moveForce * Time.deltaTime, ForceMode2D.Impulse);
        }

        if (Input.GetKey("d") || Input.GetKey(KeyCode.RightArrow))
        {
            rb2d.AddForce(Vector2.right * moveForce * Time.deltaTime, ForceMode2D.Impulse);
        }

        if (Input.GetKey("a") || Input.GetKey(KeyCode.LeftArrow))
        {
            rb2d.AddForce(Vector2.left * moveForce * Time.deltaTime, ForceMode2D.Impulse);
        }

        //Bounce away from boundaries (could get improved)
        if (pos.x == -301.5f)
        {
            rb2d.AddForce(Vector2.right * 11000f * Time.deltaTime, ForceMode2D.Impulse);
            FindObjectOfType<AudioManager>().Play("BounceS");
        }

        if (pos.x == 302f)
        {
            rb2d.AddForce(Vector2.left * 11000f * Time.deltaTime, ForceMode2D.Impulse);
            FindObjectOfType<AudioManager>().Play("BounceS");
        }

        if (pos.y == -149.8f)
        {
            rb2d.AddForce(Vector2.up * 11000f * Time.deltaTime, ForceMode2D.Impulse);
            FindObjectOfType<AudioManager>().Play("BounceS");
        }

        if (pos.y == 148.23f)
        {
            rb2d.AddForce(Vector2.down * 11000f * Time.deltaTime, ForceMode2D.Impulse);
            FindObjectOfType<AudioManager>().Play("BounceS");
        }
    }
}